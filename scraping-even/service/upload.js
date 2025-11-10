import s3 from "../config/aws.js";
import dotenv from "dotenv";
import fs from "fs";
import { PutObjectCommand } from "@aws-sdk/client-s3";

dotenv.config();
// upload zip file
async function uploadToR2(filePath, key) {
  const fileStream = fs.createReadStream(filePath);
  const command = new PutObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME,
    Key: key,
    Body: fileStream,
  });

  try {
    await s3.send(command);
    console.log(`Uploaded: ${key}`);
  } catch (err) {
    console.error(`Failed to upload ${key}:`, err.message);
  }
}

export default uploadToR2;