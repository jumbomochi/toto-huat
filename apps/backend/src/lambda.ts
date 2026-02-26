import { handle } from "hono/aws-lambda";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { createWriteStream } from "fs";
import { stat } from "fs/promises";
import { Readable } from "stream";
import { pipeline } from "stream/promises";

const DB_PATH = "/tmp/toto.db";
const BUCKET = process.env.TOTO_DATA_BUCKET!;
const KEY = "toto.db";

let dbReady = false;

async function ensureDb(): Promise<void> {
  if (dbReady) return;

  // Check if file already exists from a previous warm invocation
  try {
    const s = await stat(DB_PATH);
    if (s.size > 0) {
      dbReady = true;
      return;
    }
  } catch {
    // File doesn't exist, download it
  }

  const s3 = new S3Client({});
  const resp = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: KEY }));
  await pipeline(
    resp.Body as Readable,
    createWriteStream(DB_PATH),
  );
  dbReady = true;
}

// Set env before importing the app so DB_PATH is picked up
process.env.TOTO_DB_PATH = DB_PATH;

const { app } = await import("./server.js");

const honoHandler = handle(app);

export const handler = async (event: unknown, context: unknown) => {
  await ensureDb();
  return honoHandler(event, context);
};
