import { Cluster } from "puppeteer-cluster";
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import fs from "fs";
import path from "path";
import {
  TIME_RECORDS_FILE,
  DATA_DIR,
  FAILED_MC_LOG_FILE,
  RESUME_STATE_FILE,
  TARGET_URL,
  END_MC,
  ERR_LOG_FILE,
  LOG_FILE,
  REQ_LOG_FILE,
  START_MC,
  EVEN_RESUME_STATE_FILE,
  ODD_RESUME_STATE_FILE
} from "./utils/constants.js";

puppeteer.use(StealthPlugin());

let lastMCSaved = 0;
let shuttingDown = false;
let cluster;
let saveCount = 0;
let skippedCount = 0;
const id = Math.floor(100000 + Math.random() * 900000);

const logToFile = (file, msg) => fs.appendFileSync(file, msg + "\n");
const ensureFile = (filePath) => {
  if (!fs.existsSync(filePath)) fs.writeFileSync(filePath, "", "utf8");
};
const delay = (ms) => new Promise((res) => setTimeout(res, ms));

async function saveResume(mc, filePath) {
  fs.writeFileSync(filePath, mc + "\n");
}

async function scrapeMC({ page, data: { mcNumber, failedFile } }) {
  try {
    page.on("request", (req) => {
      const t = req.resourceType();
      if (["document", "xhr", "fetch"].includes(t))
        logToFile(REQ_LOG_FILE, `${mcNumber} → ${req.method()} ${req.url()} [${t}]`);
    });

    page.on("response", (res) => {
      const req = res.request();
      const t = req.resourceType();
      if (["document", "xhr", "fetch"].includes(t))
        logToFile(REQ_LOG_FILE, `${mcNumber} ⇐ ${res.status()} ${res.url()}`);
    });

    page.on("requestfailed", (req) => {
      logToFile(ERR_LOG_FILE, `${mcNumber} ✖ ${req.url()} ${req.failure()?.errorText}`);
    });

    await page.goto(TARGET_URL, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForSelector('input[name="query_param"][value="MC_MX"]', { timeout: 10000 });
    await page.waitForSelector('input[name="query_string"]', { timeout: 10000 });

    await page.click('input[name="query_param"][value="MC_MX"]');
    await page.type('input[name="query_string"]', mcNumber.toString());
    await Promise.all([
      page.click('input[type="submit"][value="Search"]'),
      page.waitForNavigation({ waitUntil: "domcontentloaded" }),
    ]);

    const html = await page.content();
    const filePath = path.join(DATA_DIR, `${mcNumber}.html`);
    fs.writeFileSync(filePath, html, "utf8");

    const sizeKB = (fs.statSync(filePath).size / 1024).toFixed(2);
    if (sizeKB > 30) {
      logToFile(LOG_FILE, `${mcNumber}\t${sizeKB} KB`);
      lastMCSaved = mcNumber;
      saveCount++;
      if (saveCount % 50 === 0) await delay(1000);
      console.log(`Saved MC ${mcNumber} (${sizeKB} KB)\t(${saveCount} saved)`);

    } else {
      fs.unlinkSync(filePath);
      logToFile(failedFile, mcNumber);
      skippedCount++;
      console.log(`Skipped MC ${mcNumber} (${sizeKB} KB)\t(${skippedCount} skipped)`);
    }
  } catch (err) {
    logToFile(ERR_LOG_FILE, `${mcNumber}\tError: ${err.message}`);
    logToFile(failedFile, mcNumber);
  } finally {
    await page.evaluate(() => (document.body.innerHTML = ""));
  }
}

async function shutdownHandler(reason, currentResumeFile) {
  if (shuttingDown) return;
  shuttingDown = true;

  console.log(`Shutting down (${reason})...`);
  logToFile(TIME_RECORDS_FILE, `${id}\tStopped (${reason}) at ${new Date().toISOString()}`);

  await saveResume(lastMCSaved, currentResumeFile);
  if (cluster) await cluster.idle().then(() => cluster.close());
  process.exit(0);
}

process.on("SIGINT", () => shutdownHandler("SIGINT"));
process.on("SIGTERM", () => shutdownHandler("SIGTERM"));
process.on("uncaughtException", (err) => {
  logToFile(ERR_LOG_FILE, `${id}\tUncaught Exception: ${err.stack}`);
  shutdownHandler("uncaughtException");
});
process.on("unhandledRejection", (err) => {
  logToFile(ERR_LOG_FILE, `${id}\tUnhandled Rejection: ${err}`);
  shutdownHandler("unhandledRejection");
});

async function runCluster() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
  [LOG_FILE, REQ_LOG_FILE, ERR_LOG_FILE, RESUME_STATE_FILE, FAILED_MC_LOG_FILE, TIME_RECORDS_FILE].forEach(ensureFile);

  const arg = process.argv[2];
  const mcType = arg === "e" ? "even" : arg === "o" ? "odd" : "all";
  console.log(`Cluster Scraper ID: ${id} (${mcType})`);
  logToFile(TIME_RECORDS_FILE, `${id}\tStarted for ${mcType} MCs at ${new Date().toISOString()}`);

  // ✅ Pick correct resume + failed log files
  const currentResumeFile =
    mcType === "even"
      ? EVEN_RESUME_STATE_FILE
      : mcType === "odd"
      ? ODD_RESUME_STATE_FILE
      : RESUME_STATE_FILE;

  const currentFailedFile =
    mcType === "even"
      ? FAILED_MC_LOG_FILE.replace(".txt", "_even.txt")
      : mcType === "odd"
      ? FAILED_MC_LOG_FILE.replace(".txt", "_odd.txt")
      : FAILED_MC_LOG_FILE;

  ensureFile(currentResumeFile);
  ensureFile(currentFailedFile);

  const lastSaved =
    fs.existsSync(currentResumeFile) && fs.readFileSync(currentResumeFile, "utf8").trim()
      ? Number(fs.readFileSync(currentResumeFile, "utf8"))
      : START_MC - 1;
  const resumeStart = lastSaved + 1;

  cluster = await Cluster.launch({
    concurrency: Cluster.CONCURRENCY_PAGE,
    maxConcurrency: 5,
    puppeteer,
    puppeteerOptions: { headless: true, args: ["--no-sandbox", "--disable-setuid-sandbox"] },
    timeout: 5 * 60 * 1000,
    monitor: false,
  });

  await cluster.task(async ({ page, data: mc }) => {
    await scrapeMC({ page, data: { mcNumber: mc, failedFile: currentFailedFile } });
    await saveResume(mc, currentResumeFile);
  });

  let queued = 0;
  for (let mc = resumeStart; mc <= END_MC; mc++) {
    if (arg === "e" && mc % 2 !== 0) continue;
    if (arg === "o" && mc % 2 === 0) continue;
    cluster.queue(mc);
    queued++;
    if (queued % 200 === 0) await delay(1000);
  }
  console.log(`📥 Queued ${queued} MC numbers`);

  await cluster.idle();
  await cluster.close();

  logToFile(TIME_RECORDS_FILE, `${id}\tFinished all at ${new Date().toISOString()}`);
  console.log("✅ All scraping complete!");
}

runCluster().catch(console.error);
