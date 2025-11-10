import { Cluster } from "puppeteer-cluster";
import fs from "fs";
import path from "path";
import uploadToR2 from "./service/upload.js";
import createZipBatch from "./service/zip.js";

const TARGET_URL = "https://safer.fmcsa.dot.gov/CompanySnapshot.aspx";

const DATA_DIR = "../html_data";
const LOG_FILE = "../logs.txt";
const RESUME_STATE_FILE = "./resume.txt";
const REQ_LOG_FILE = "./request_logs.txt";
const ERR_LOG_FILE = "./error_logs.txt";
const FAILED_MC_LOG_FILE = "./failed_MC.txt";
const START_MC = 1500001;
const END_MC = 1769004;
const CONCURRENCY = 10;
const BATCH_SIZE = 5;
let savedFiles = [];

async function runCluster() {

  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

  await checkAndCreateFile(LOG_FILE);
  await checkAndCreateFile(REQ_LOG_FILE);
  await checkAndCreateFile(ERR_LOG_FILE);
  await checkAndCreateFile(RESUME_STATE_FILE);
  await checkAndCreateFile(FAILED_MC_LOG_FILE);

 
 
  const lastMC = await loadState();
  if (lastMC == END_MC) {
    console.log("All MC numbers have been processed.");
    return;
  }
  console.log("Resuming from MC number:", lastMC);
  const resumeMC = lastMC.length > 0 ? Math.max(...lastMC) + 1 : START_MC;


  console.log(
    `Total: ${END_MC - START_MC + 1} | Done: ${END_MC - lastMC}`
  );



  const cluster = await Cluster.launch({
    concurrency: Cluster.CONCURRENCY_PAGE,
    maxConcurrency: CONCURRENCY,
    puppeteerOptions: {
      headless: true, // change to true for silent mode
      defaultViewport: null,
    },
    timeout: 180000,
  });

  await cluster.task(async ({ page, data: mcNumber }) => {
    try {
      await page.goto(TARGET_URL, { waitUntil: "domcontentloaded" });
      await page.click('input[name="query_param"][value="MC_MX"]');
      await page.type('input[name="query_string"]', mcNumber.toString());
      await Promise.all([
        page.click('input[type="submit"][value="Search"]'),
        page.waitForNavigation({ waitUntil: "domcontentloaded" }),
      ]);
      // const requests = [];
      page.on("request", req => {
        const data = `${mcNumber} Request: ${req.method()} ${req.url()} [${req.resourceType()}]`;
        reqLogs(data, "request");
      });
      page.on("requestfailed", req => {
        const data = `${mcNumber} Request failed: ${req.url()} ${req.failure()?.errorText}`;
        reqLogs(data, "error");
      });
      page.on("response", res => {
        const data = `${mcNumber} | Response: ${res.status()} ${res.url()} `;
        reqLogs(data, "response");
      });

      const html = await page.content();
      const filePath = `${DATA_DIR}/${mcNumber}.html`;
      fs.writeFileSync(filePath, html, "utf8");

      const stats = fs.statSync(filePath);
      const fileSizeKB = (stats.size / 1024).toFixed(2);

      fs.appendFileSync(LOG_FILE, `${mcNumber} \t ${fileSizeKB} KB\n`);
      console.log(`Saved MC ${mcNumber} (${fileSizeKB} KB)`);
      if (fileSizeKB > 35) {
        savedFiles.push(mcNumber);
      } else {
        fs.unlinkSync(filePath);
      }
      if (savedFiles.length >= BATCH_SIZE) {
        const zipPath = await createZipBatch(savedFiles, Math.floor(mcNumber / BATCH_SIZE));
        const zipName = path.basename(zipPath);
        await uploadToR2(zipPath, zipName);
        savedFiles = [];
        await deleteAllFiles(savedFiles);
        fs.unlinkSync(zipPath);
      }

    } catch (err) {
      console.error(`Failed MC ${mcNumber}: ${err.message}`);
      await logFailedMC(mcNumber);
    }
  });

  // for (const mc of pendingMCs) cluster.queue(mc);
  for (let mc = resumeMC; mc <= END_MC; mc++) {
    cluster.queue(mc);
  }

  await cluster.idle();
  await cluster.close();

  console.log("🏁 All scraping complete!");
}

// runCluster().catch(console.error);

// uploadToR2("../batch/batch_0.zip", "batch_0.zip").catch(console.error);

// runCluster().catch(console.error);
console.log("Resuming from MC number:", resumeMC);