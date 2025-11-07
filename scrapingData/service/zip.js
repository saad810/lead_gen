
import fs from "fs-extra";
import path from "path";
import archiver from "archiver";

const SRC_DIR = "../../data";    // folder containing your .html files
const DEST_DIR = "../../batch";      // folder for zip outputs
const BATCH_SIZE = 500;            // number of HTML files per zip

// await fs.ensureDir(DEST_DIR);

// // get list of html files
// const allFiles = (await fs.readdir(SRC_DIR))
//     .filter(f => f.endsWith(".html"))
//     .map(f => path.join(SRC_DIR, f));
// const filesToProcess = [];
// for (const file of allFiles) {
//     const stats = await fs.stat(file);
//     // size to KB
//     const fileSizeKB = (stats.size / 1024).toFixed(2);
//     if (fileSizeKB > 40) {
//         filesToProcess.push(file);
//     }
// }

// async function createZipBatch() {

//     let batchIndex = 0;

//     for (let i = 0; i < filesToProcess.length; i += BATCH_SIZE) {

//         const batch = filesToProcess.slice(i, i + BATCH_SIZE);
//         const zipName = `batch_${batchIndex}.zip`;
//         const zipPath = path.join(DEST_DIR, zipName);

//         console.log(`Creating ${zipName} (${batch.length} files)...`);

//         await new Promise((resolve, reject) => {
//             const output = fs.createWriteStream(zipPath);
//             const archive = archiver("zip", { zlib: { level: 9 } }); // level 9 = max compression

//             output.on("close", () => {
//                 console.log(`${zipName} created: ${(archive.pointer() / 1024 / 1024).toFixed(2)} MB`);
//                 resolve();
//             });
//             archive.on("error", reject);

//             archive.pipe(output);
//             batch.forEach(file => {
//                 archive.file(file, { name: path.basename(file) });
//             });

//             archive.finalize();
//         });

//         batchIndex++;
//     }

//     console.log("All batches created successfully.");
// }

// createZipBatch().catch(err => {
//     console.error("Error creating zip batches:", err);
// });


async function createZipBatch(files, batchIndex) {
    const zipName = `batch_${batchIndex}.zip`;
    const zipPath = path.join(DEST_DIR, zipName);   

    console.log(`Creating ${zipName} (${files.length} files)...`);

    await new Promise((resolve, reject) => {
        const output = fs.createWriteStream(zipPath);
        const archive = archiver("zip", { zlib: { level: 9 } }); // level 9 = max compression
        output.on("close", () => {
            console.log(`${zipName} created: ${(archive.pointer() / 1024 / 1024).toFixed(2)} MB`);
            resolve();
        });
        archive.on("error", reject);
        archive.pipe(output);
        files.forEach(file => {
            archive.file(file, { name: path.basename(file) });
        });
        archive.finalize();
    });

    return zipPath;
}

export default createZipBatch;