import { Cluster } from "puppeteer-cluster";
import fs from "fs";
import path from "path";
import uploadToR2 from "./service/upload.js";
import createZipBatch from "./service/zip.js";

const TARGET_URL = "https://safer.fmcsa.dot.gov/CompanySnapshot.aspx";
const DATA_DIR = "../html_data";
const LOG_FILE = "../logs.txt";
const START_MC = 1700001;
const END_MC = 1769004;
const CONCURRENCY = 10;
const BATCH_SIZE = 1000; // number of HTML files per zip
let savedFiles = [];
async function runCluster() {

  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
  if (!fs.existsSync(LOG_FILE)) fs.writeFileSync(LOG_FILE, "MC_NUMBER \t FILE_SIZE_KB\n");

  const existingFiles = new Set(
    fs
      .readdirSync(DATA_DIR)
      .filter(f => f.endsWith(".html"))
      .map(f => parseInt(path.basename(f, ".html"), 10))
  );

  const pendingMCs = [];
  for (let mc = START_MC; mc <= END_MC; mc++) {
    if (!existingFiles.has(mc)) pendingMCs.push(mc);
  }

  console.log(
    `Total: ${END_MC - START_MC + 1} | Done: ${existingFiles.size} | Pending: ${pendingMCs.length}`
  );

  if (pendingMCs.length === 0) {
    console.log("All MCs already scraped!");
    return;
  }

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

      const html = await page.content();
      const filePath = `${DATA_DIR}/${mcNumber}.html`;
      fs.writeFileSync(filePath, html, "utf8");

      const stats = fs.statSync(filePath);
      const fileSizeKB = (stats.size / 1024).toFixed(2);

      fs.appendFileSync(LOG_FILE, `${mcNumber} \t ${fileSizeKB} KB\n`);
      console.log(`Saved MC ${mcNumber} (${fileSizeKB} KB)`);
      if (fileSizeKB > 35) {
        savedFiles.push(mcNumber);
      }
      if (savedFiles.length >= BATCH_SIZE) {
        const zipPath = await createZipBatch(savedFiles, Math.floor(mcNumber / BATCH_SIZE));
        const zipName = path.basename(zipPath);
        await uploadToR2(zipPath, zipName);
        savedFiles = [];
      }

    } catch (err) {
      console.error(`❌ Failed MC ${mcNumber}: ${err.message}`);
    }
  });

  for (const mc of pendingMCs) cluster.queue(mc);

  await cluster.idle();
  await cluster.close();

  console.log("🏁 All scraping complete!");
}

runCluster().catch(console.error);

// uploadToR2("../batch/batch_0.zip", "batch_0.zip").catch(console.error);