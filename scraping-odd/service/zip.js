
import fs from "fs";
import path from "path";
import archiver from "archiver";

const SRC_DIR = "../html";
const DEST_DIR = "../batch";

async function createZipBatch(files, batchIndex) {
    const zipName = `batch_${batchIndex}.zip`;
    const zipPath = path.join(DEST_DIR, zipName);
    const filePaths = files.map(mc => path.join(SRC_DIR, `${mc}.html`));

    console.log(`Creating ${zipName} (${filePaths.length} files)...`);
    
    // console.log(filePaths);
    // console.log(files);
    await new Promise((resolve, reject) => {
        const output = fs.createWriteStream(zipPath);
        const archive = archiver("zip", { zlib: { level: 9 } }); // level 9 = max compression

        output.on("close", () => {
            console.log(`${zipName} created: ${(archive.pointer() / 1024 / 1024).toFixed(2)} MB`);
            resolve();
        });
        archive.on("error", reject);

        archive.pipe(output);
        filePaths.forEach(file => {
            archive.file(file, { name: path.basename(file) });
        });

        archive.finalize();
    });

    return zipPath;
}

export default createZipBatch;