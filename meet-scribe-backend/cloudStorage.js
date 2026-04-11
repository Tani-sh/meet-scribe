/**
 * Cloud Storage — AWS S3 with local filesystem fallback
 * Stores transcripts and summaries.
 * Falls back to local `data/` when S3 is not configured.
 */

const fs = require('fs');
const path = require('path');

// ─── S3 Client Setup ────────────────────────────────────────────────────────
let s3Client = null;
let bucketName = process.env.S3_BUCKET_NAME || null;

try {
  if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY && bucketName) {
    const { S3Client } = require('@aws-sdk/client-s3');
    s3Client = new S3Client({
      region: process.env.AWS_REGION || 'ap-south-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
    });
    console.log(`☁️  AWS S3 configured (bucket: ${bucketName}, region: ${process.env.AWS_REGION || 'ap-south-1'})`);
  }
} catch (e) {
  console.log('📁 Using local filesystem storage (S3 not configured)');
}

const LOCAL_DIR = path.join(__dirname, 'data');

// Ensure local dirs exist
for (const sub of ['transcripts', 'summaries']) {
  const dir = path.join(LOCAL_DIR, sub);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// ─── S3 Helpers ─────────────────────────────────────────────────────────────

async function s3Put(key, data) {
  const { PutObjectCommand } = require('@aws-sdk/client-s3');
  await s3Client.send(new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    Body: data,
    ContentType: 'application/json',
  }));
}

async function s3Get(key) {
  const { GetObjectCommand } = require('@aws-sdk/client-s3');
  const response = await s3Client.send(new GetObjectCommand({
    Bucket: bucketName,
    Key: key,
  }));
  const body = await response.Body.transformToString();
  return JSON.parse(body);
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Save a transcript to storage
 */
async function saveTranscript(sessionId, transcript) {
  const data = JSON.stringify({ sessionId, transcript, savedAt: new Date().toISOString() }, null, 2);

  if (s3Client && bucketName) {
    try {
      await s3Put(`transcripts/${sessionId}.json`, data);
      console.log(`☁️  Transcript saved to S3: transcripts/${sessionId}.json`);
      return;
    } catch (err) {
      console.warn('S3 save failed, falling back to local:', err.message);
    }
  }

  // Local fallback
  const filePath = path.join(LOCAL_DIR, 'transcripts', `${sessionId}.json`);
  fs.writeFileSync(filePath, data);
  console.log(`📁 Transcript saved locally: ${filePath}`);
}

/**
 * Save a summary to storage
 */
async function saveSummary(sessionId, summary) {
  const data = JSON.stringify({ sessionId, summary, savedAt: new Date().toISOString() }, null, 2);

  if (s3Client && bucketName) {
    try {
      await s3Put(`summaries/${sessionId}.json`, data);
      console.log(`☁️  Summary saved to S3: summaries/${sessionId}.json`);
      return;
    } catch (err) {
      console.warn('S3 save failed, falling back to local:', err.message);
    }
  }

  // Local fallback
  const filePath = path.join(LOCAL_DIR, 'summaries', `${sessionId}.json`);
  fs.writeFileSync(filePath, data);
  console.log(`📁 Summary saved locally: ${filePath}`);
}

/**
 * Retrieve a transcript from storage
 */
async function getTranscript(sessionId) {
  if (s3Client && bucketName) {
    try {
      return await s3Get(`transcripts/${sessionId}.json`);
    } catch (err) { /* fall through */ }
  }

  const filePath = path.join(LOCAL_DIR, 'transcripts', `${sessionId}.json`);
  if (fs.existsSync(filePath)) {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  }
  return null;
}

/**
 * Retrieve a summary from storage
 */
async function getSummary(sessionId) {
  if (s3Client && bucketName) {
    try {
      return await s3Get(`summaries/${sessionId}.json`);
    } catch (err) { /* fall through */ }
  }

  const filePath = path.join(LOCAL_DIR, 'summaries', `${sessionId}.json`);
  if (fs.existsSync(filePath)) {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  }
  return null;
}

module.exports = { saveTranscript, saveSummary, getTranscript, getSummary };
