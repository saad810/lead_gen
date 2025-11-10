import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import fs from "fs";
import path from "path";
import uploadToR2 from "./service/upload.js";
import createZipBatch from "./service/zip.js";
import { TIME_RECORDS_FILE, BATCH_SIZE, DATA_DIR, FAILED_MC_LOG_FILE, RESUME_STATE_FILE, TARGET_URL, END_MC, ERR_LOG_FILE, LOG_FILE, REQ_LOG_FILE, START_MC, LAST_ZIPPED_STATE_FILE } from "./utils/constants.js";
import { start } from "repl";

let savedFiles = [];
let currentMC = null;
let lastMCSaved = " ";
let savedCount = 0;

puppeteer.use(StealthPlugin());

function delay(ms) {
  console.log(`Waiting for ${ms} ms...`);
  return new Promise(resolve => setTimeout(resolve, ms));
}


function ensureFile(filePath) {
  if (!fs.existsSync(filePath)) fs.writeFileSync(filePath, "", "utf8");
}

function logToFile(file, message) {
  fs.appendFileSync(file, `${message}\n`);
}
async function loadLastZippedMC() {
  if (fs.existsSync(LAST_ZIPPED_STATE_FILE)) {
    const data = fs.readFileSync(LAST_ZIPPED_STATE_FILE, "utf8").trim();
    if (data) return Number(data);
  }
  return START_MC - 1; // means no zip yet
}
function getRandom6Digit() {
  return Math.floor(100000 + Math.random() * 900000);
}

async function saveLastZippedMC(mcNumber) {
  fs.writeFileSync(LAST_ZIPPED_STATE_FILE, `${mcNumber}\n`);
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
    // lastMCSaved = mcNumber;
    console.log(`Saved MC ${mcNumber} (${fileSizeKB} KB)`);

    if (fileSizeKB > 35) {
      savedFiles.push(mcNumber)
      savedCount++;
    } else {
      logToFile(FAILED_MC_LOG_FILE, mcNumber);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      } else {
        console.log(`File not found: ${filePath}`);
      }

    };

    // if (savedFiles.length >= BATCH_SIZE) {

    //   const zipPath = await createZipBatch(savedFiles, Math.floor(mcNumber / BATCH_SIZE));
    //   await uploadToR2(zipPath, path.basename(zipPath));

    //   lastMCSaved = mcNumber;
    //   await saveResume(lastMCSaved);
    //   await deleteFiles(savedFiles);
    //   // fs.unlinkSync(zipPath);
    //   savedFiles = [];
    //   savedCount = 0;
    // }
    if (savedFiles.length >= BATCH_SIZE) {
      const zipPath = await createZipBatch(savedFiles, Math.floor(mcNumber / BATCH_SIZE));
      await uploadToR2(zipPath, path.basename(zipPath));
      logToFile(TIME_RECORDS_FILE, `${id}\tZip ${zipPath} Created at: ${new Date(endTime).toISOString()}`);

      lastMCSaved = mcNumber;
      await saveLastZippedMC(lastMCSaved);
      await deleteFiles(savedFiles);



      savedFiles = [];
      savedCount = 0;
    }

    await saveResume(mcNumber);
    console.log(`Saved Files Count: ${savedCount}`);
  } catch (err) {
    console.error(`Failed MC ${mcNumber}: ${err.message}`);
    logToFile(FAILED_MC_LOG_FILE, mcNumber);
  } finally {
    await page.evaluate(() => {
      document.body.innerHTML = "";
    });
  }
}

const id = getRandom6Digit();


async function runScraper() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
  [LOG_FILE, LAST_ZIPPED_STATE_FILE, REQ_LOG_FILE, ERR_LOG_FILE, RESUME_STATE_FILE, FAILED_MC_LOG_FILE, TIME_RECORDS_FILE].forEach(ensureFile);
  const arg = process.argv[2];
  const mcNO = arg === 'e' ? 'even' : arg === 'o' ? 'odd' : 'all';
  console.log(`Scraper ID: ${id} - Scraping MC Numbers: ${mcNO}`);


  const time = Date.now();
  logToFile(TIME_RECORDS_FILE, `${id}\t${mcNO}\tScraping started at: ${new Date(time).toISOString()}`);
  let lastCheck = Date.now();
  setInterval(() => {
    const now = Date.now();
    // if system sleep or freeze lasted > 10 seconds
    if (now - lastCheck > 10000) {
      const delaySec = Math.round((now - lastCheck) / 1000);
      logToFile(
        TIME_RECORDS_FILE,
        `${id}\t${mcNO}\tSystem likely resumed from sleep at: ${new Date().toISOString()} (paused ${delaySec}s)`
      );
    }
    lastCheck = now;
  }, 5000);
  const lastZippedMC = await loadLastZippedMC();
  const lastMCs = await loadResume();

  let startMC = START_MC;
  if (lastZippedMC) {
    startMC = lastZippedMC + 1;
  } else if (lastMCs.length > 0) {
    startMC = Math.max(...lastMCs) + 1;
  } else {
    startMC = START_MC;
  }
  console.log("Resuming from MC number:", startMC);

  const browser = await puppeteer.launch({
    headless: true,
    defaultViewport: null,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await browser.newPage();

  page.on("request", req => {
    const type = req.resourceType();
    const url = req.url();

    if (["document", "xhr", "fetch"].includes(type) && currentMC) {
      logToFile(REQ_LOG_FILE, `${currentMC} Request: ${req.method()} ${url} [${type}]`);
    }
  });

  page.on("requestfailed", req => {
    const type = req.resourceType();
    const url = req.url();

    // if (["document", "xhr", "fetch"].includes(type) && currentMC) {
    logToFile(ERR_LOG_FILE, `${currentMC} Request failed: ${url} ${req.failure()?.errorText}`);
    // }
  });

  page.on("response", res => {
    const req = res.request();
    const type = req.resourceType();
    const url = res.url();

    if (["document", "xhr", "fetch"].includes(type) && currentMC) {
      logToFile(REQ_LOG_FILE, `${currentMC} Response: ${res.status()} ${url}`);
    }
  });

  for (let mc = startMC; mc <= END_MC; mc++) {
    if (arg === 'e' && mc % 2 !== 0) continue; 
    if (arg === 'o' && mc % 2 === 0) continue; 
    await scrapeMC(page, mc);
    const waitMs = Math.floor(Math.random() * (3000 - 1000 + 1)) + 1000;
    await delay(waitMs);
  }

  await browser.close();
  console.log(" All scraping complete!");
  const endTime = Date.now();
  logToFile(TIME_RECORDS_FILE, `${id}\t${mcNO}\tScraping ended at: ${new Date(endTime).toISOString()}`);
  logToFile(TIME_RECORDS_FILE, `${id}\t${mcNO}\tTotal duration: ${((endTime - time) / 1000 / 60).toFixed(2)} minutes`);
}



process.on("SIGINT", () => {
  const stopTime = new Date().toISOString();
  logToFile(TIME_RECORDS_FILE, `${id}\tStopped Manually: ${stopTime}`);
  deleteFiles(savedFiles).then(() => {
    if (savedCount < BATCH_SIZE) {
      saveResume(lastMCSaved).then(() => {
        process.exit();
      });
    }
  });
});

process.on("SIGTERM", () => {
  const stopTime = new Date().toISOString();
  logToFile(TIME_RECORDS_FILE, `${id}\tScraper Terminated: ${stopTime}`);
  deleteFiles(savedFiles).then(() => {
    if (savedCount < BATCH_SIZE) {
      saveResume(lastMCSaved).then(() => {
        process.exit();
      });
    }
  });
});

process.on("uncaughtException", err => {
  const stopTime = new Date().toISOString();
  logToFile(TIME_RECORDS_FILE, `${id}\tUncaught Exception: ${stopTime}: ${err.message}`);
  logToFile(ERR_LOG_FILE, `${id}\tUncaught Exception: ${err.stack}`);
  deleteFiles(savedFiles).then(() => {
    if (savedCount < BATCH_SIZE) {
      saveResume(lastMCSaved).then(() => {
        process.exit();
      });
    }
  });
});

process.on("unhandledRejection", err => {
  const stopTime = new Date().toISOString();
  logToFile(TIME_RECORDS_FILE, `${id}\t${stopTime}: ${err}`);
  logToFile(ERR_LOG_FILE, `${id}\tUnhandled Rejection: ${err}`);
  deleteFiles(savedFiles).then(() => {
    if (savedCount < BATCH_SIZE) {
      saveResume(lastMCSaved).then(() => {
        process.exit();
      });
    }
  });
});

runScraper().catch(console.error);
