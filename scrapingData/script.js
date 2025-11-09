import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import fs from "fs";
import path from "path";
import uploadToR2 from "./service/upload.js";
import createZipBatch from "./service/zip.js";
import { BATCH_SIZE, DATA_DIR, FAILED_MC_LOG_FILE, RESUME_STATE_FILE, TARGET_URL, END_MC, ERR_LOG_FILE, LOG_FILE, REQ_LOG_FILE, START_MC } from "./utils/constants.js";

let savedFiles = [];
let currentMC = null;

puppeteer.use(StealthPlugin());

function ensureFile(filePath) {
  if (!fs.existsSync(filePath)) fs.writeFileSync(filePath, "", "utf8");
}

function logToFile(file, message) {
  fs.appendFileSync(file, `${message}\n`);
}

async function loadResume() {
  if (fs.existsSync(RESUME_STATE_FILE)) {
    const data = fs.readFileSync(RESUME_STATE_FILE, "utf8").trim();
    if (data) return data.split("\n").map(Number);
  }
  return [];
}

async function saveResume(mcNumber) {
  fs.writeFileSync(RESUME_STATE_FILE, `${mcNumber}\n`);
}

async function deleteFiles(files) {
  for (const name of files) {
    try {
      fs.unlinkSync(path.join(DATA_DIR, `${name}.html`));
    } catch { }
  }
}

async function scrapeMC(page, mcNumber) {
  currentMC = mcNumber;
  try {
    await page.goto(TARGET_URL, { waitUntil: "domcontentloaded" });

    await page.click('input[name="query_param"][value="MC_MX"]');
    await page.type('input[name="query_string"]', mcNumber.toString());

    await Promise.all([
      page.click('input[type="submit"][value="Search"]'),
      page.waitForNavigation({ waitUntil: "domcontentloaded" }),
    ]);

    const html = await page.content();
    const filePath = path.join(DATA_DIR, `${mcNumber}.html`);
    fs.writeFileSync(filePath, html, "utf8");

    const fileSizeKB = (fs.statSync(filePath).size / 1024).toFixed(2);
    logToFile(LOG_FILE, `${mcNumber} \t ${fileSizeKB} KB`);
    console.log(`Saved MC ${mcNumber} (${fileSizeKB} KB)`);

    if (fileSizeKB > 35) savedFiles.push(mcNumber);
    else {
      logToFile(FAILED_MC_LOG_FILE, mcNumber);
      fs.unlinkSync(filePath)
    };

    if (savedFiles.length >= BATCH_SIZE) {
      const zipPath = await createZipBatch(savedFiles, Math.floor(mcNumber / BATCH_SIZE));
      await uploadToR2(zipPath, path.basename(zipPath));
      await deleteFiles(savedFiles);
      // fs.unlinkSync(zipPath);
      savedFiles = [];
    }

    await saveResume(mcNumber);
  } catch (err) {
    console.error(`Failed MC ${mcNumber}: ${err.message}`);
    logToFile(FAILED_MC_LOG_FILE, mcNumber);
  } finally {
    // Light page reset (avoid memory leaks)
    await page.evaluate(() => {
      document.body.innerHTML = "";
    });
  }
}

async function runScraper() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
  [LOG_FILE, REQ_LOG_FILE, ERR_LOG_FILE, RESUME_STATE_FILE, FAILED_MC_LOG_FILE].forEach(ensureFile);

  const lastMCs = await loadResume();
  const startMC = lastMCs.length > 0 ? Math.max(...lastMCs) + 1 : START_MC;
  console.log("Resuming from MC number:", startMC);

  const browser = await puppeteer.launch({
    headless: true,
    defaultViewport: null,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await browser.newPage();

  // Attach global request/response tracking ONCE
  page.on("request", req => {
    if (currentMC)
      logToFile(REQ_LOG_FILE, `${currentMC} Request: ${req.method()} ${req.url()} [${req.resourceType()}]`);
  });
  page.on("requestfailed", req => {
    if (currentMC)
      logToFile(ERR_LOG_FILE, `${currentMC} Request failed: ${req.url()} ${req.failure()?.errorText}`);
  });
  page.on("response", res => {
    if (currentMC)
      logToFile(REQ_LOG_FILE, `${currentMC} Response: ${res.status()} ${res.url()}`);
  });

  for (let mc = startMC; mc <= END_MC; mc++) {
    await scrapeMC(page, mc);
  }

  await browser.close();
  console.log(" All scraping complete!");
}

runScraper().catch(console.error);
