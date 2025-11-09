// import * as cheerio from "cheerio";
// import fs from "fs";
// import path from "path";
// import Company from "./models/company.model.js";
// import connectDB from "./config/db.js";

// const DATA_DIR = "../data";
// const SUCCESS_FILE = "./parsed.txt";
// const LOG_FILE = "./logs.txt";

// let incorrectCount = 0;
// let successDBInserts = 0;
// // create if not exists
// if (!fs.existsSync(SUCCESS_FILE)) {
//     fs.writeFileSync(SUCCESS_FILE, " ");
// }

// const htmlFiles = new Set(
//     fs
//         .readdirSync(DATA_DIR)
//         .filter(f => f.endsWith(".html"))
//         .map(f => parseInt(path.basename(f, ".html"), 10))
// );

// const successParsed = new Set(
//     fs.existsSync(SUCCESS_FILE)
//         ? fs.readFileSync(SUCCESS_FILE, "utf8").split("\n").filter(Boolean)
//         : []
// );

// const toParse = [...htmlFiles].filter(mcid => !successParsed.has(mcid));

// let companyData = [];

// async function mainParsing(mcid) {
//     const filePath = path.join(DATA_DIR, `${mcid}.html`);
//     const stats = fs.statSync(filePath);
//     const sizeInKB = (stats.size / 1024).toFixed(2);
//     if(sizeInKB < 40) {
//         incorrectCount++;
//         fs.appendFileSync(LOG_FILE, `File too small for MCID ${mcid}: ${sizeInKB} KB\n`);
//         return;
//     }

//     const htmlContent = fs.readFileSync(filePath, "utf8");
//     const $ = cheerio.load(htmlContent);
//     const clean = (text) => text?.replace(/\s+/g, " ").trim() || null;

//     // Extract fields
//     const data = {
//         companyName: clean($("b:contains('LLC'), b:contains('INC'), b:contains('TRUCK'), b:contains('TRANS')").first().text()) || clean($("font b").first().text()),
//         entityType: clean($("th:contains('Entity Type:')").next().text()),
//         usdDotStatus: clean($("th:contains('USDOT Status:')").next().text()),
//         operatingStatus: clean($("th:contains('Operating Authority Status:')").next().text()),
//         mcNumber: clean($("th:contains('MC/MX/FF Number')").next().text().replace(/\s+/g, " ")),
//         legalName: clean($("th:contains('Legal Name:')").next().text()),
//         dbaName: clean($("th:contains('DBA Name:')").next().text()),
//         physicalAddress: clean($("#physicaladdressvalue").html()?.replace(/<br>/g, " ").replace(/&nbsp;/g, " ")),
//         mailingAddress: clean($("#mailingaddressvalue").html()?.replace(/<br>/g, " ").replace(/&nbsp;/g, " ")),
//         phone: clean($("th:contains('Phone:')").next().text()),
//         mcs150Date: clean($("th:contains('MCS-150 Form Date:')").next().text()),
//         mcs150Mileage: clean($("th:contains('MCS-150 Mileage')").next().text()),
//         powerUnits: clean($("th:contains('Power Units:')").next().text()),
//         drivers: clean($("th:contains('Drivers:')").next().text()),
//     };

//     if (data.phone && data.companyName && data.mcNumber) {
//         companyData.push({ mcid, ...data });
//     } else {
//         incorrectCount++;
//         fs.appendFileSync(LOG_FILE, `Incorrect Data for MCID ${mcid}: ${incorrectCount}\n`);
//     }


//     // const jsonStr = JSON.stringify(data);
//     // const sizeBytes = Buffer.byteLength(jsonStr, 'utf8');
//     // const sizeKB = (sizeBytes / 1024).toFixed(2);
// }

// async function main() {
//     // const files = htmlFiles;
//     await connectDB();
//     await Company.syncIndexes();

//     const files = Array.from(toParse);
//     while (files.length > 0) {
//         const mcid = files.shift();
//         // let currindex = 
//         try {
//             await mainParsing(mcid);
//             if (companyData.length >= 20) {
//                 // Bulk insert to DB
//                 try {
//                     await Company.insertMany(companyData, { ordered: false });
//                     fs.appendFileSync(SUCCESS_FILE, companyData.map(c => c.mcid).join("\n") + "\n");
//                     companyData = [];
//                     successDBInserts += 20;
//                 } catch (error) {
//                     console.log("Error during bulk insert:", error.message);
//                     fs.appendFileSync(LOG_FILE, `Error: BULK_INSERT ${files.length} | Batch_Size ${companyData.length}\n records: ${error.message}\n\n`);
//                     companyData = [];
//                     continue;
//                 }
//             }
//         } catch (error) {
//             fs.appendFileSync(LOG_FILE, `Error parsing MCID ${mcid}: ${error}\n`);
//         }
//     }
//     if (companyData.length > 0) {
//         await Company.insertMany(companyData, { ordered: false });
//         fs.appendFileSync(SUCCESS_FILE, companyData.map(c => c.mcid).join("\n") + "\n");
//         console.log(`Inserted final ${companyData.length} records.`);
//         // breal
//     }
//     console.log("Parsing and insertion complete.");
//     console.log(`Total successful DB inserts: ${successDBInserts}`);
//     console.log(`Total incorrect records: ${incorrectCount}`);
// }


// main();

