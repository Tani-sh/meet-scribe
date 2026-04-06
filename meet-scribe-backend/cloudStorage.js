/**
 * Cloud Storage — GCP Cloud Storage with local filesystem fallback
 * Stores transcripts and summaries. Falls back to local `data/` when GCP is not configured.
 */

const fs = require('fs');
const path = require('path');

// Check if GCP is configured
let storage = null;
let bucketName = process.env.GCS_BUCKET_NAME || null;

try {
  if (process.env.GCS_KEY_FILE || process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    const { Storage } = require('@google-cloud/storage');
    storage = new Storage({
      keyFilename: process.env.GCS_KEY_FILE || process.env.GOOGLE_APPLICATION_CREDENTIALS,
    });
    console.log('☁️ GCP Cloud Storage configured');
  }
} catch (e) {
  console.log('📁 Using local filesystem storage (GCP not configured)');
}

const LOCAL_DIR = path.join(__dirname, 'data');

// Ensure local dirs exist
for (const sub of ['transcripts', 'summaries']) {
  const dir = path.join(LOCAL_DIR, sub);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

/**
 * Save a transcript to storage
 */
async function saveTranscript(sessionId, transcript) {
  const data = JSON.stringify({ sessionId, transcript, savedAt: new Date().toISOString() }, null, 2);

  if (storage && bucketName) {
    try {
      const file = storage.bucket(bucketName).file(`transcripts/${sessionId}.json`);
      await file.save(data, { contentType: 'application/json' });
      console.log(`☁️ Transcript saved to GCS: transcripts/${sessionId}.json`);
      return;
    } catch (err) {
      console.warn('GCS save failed, falling back to local:', err.message);
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

  if (storage && bucketName) {
    try {
      const file = storage.bucket(bucketName).file(`summaries/${sessionId}.json`);
      await file.save(data, { contentType: 'application/json' });
      console.log(`☁️ Summary saved to GCS: summaries/${sessionId}.json`);
      return;
    } catch (err) {
      console.warn('GCS save failed, falling back to local:', err.message);
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
  if (storage && bucketName) {
    try {
      const file = storage.bucket(bucketName).file(`transcripts/${sessionId}.json`);
      const [content] = await file.download();
      return JSON.parse(content.toString());
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
  if (storage && bucketName) {
    try {
      const file = storage.bucket(bucketName).file(`summaries/${sessionId}.json`);
      const [content] = await file.download();
      return JSON.parse(content.toString());
    } catch (err) { /* fall through */ }
  }

  const filePath = path.join(LOCAL_DIR, 'summaries', `${sessionId}.json`);
  if (fs.existsSync(filePath)) {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  }
  return null;
}

module.exports = { saveTranscript, saveSummary, getTranscript, getSummary };
