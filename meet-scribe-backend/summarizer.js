/**
 * Summarizer — Gemini 2.0 Flash (cloud, primary) with basic fallback
 * No local dependencies needed — works entirely online.
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');

const SUMMARY_PROMPT = `You are an expert meeting summarizer.
Given the following meeting transcript, generate a well-structured summary in this exact format:

## Executive Summary
(3-4 sentences capturing the overall meeting purpose and outcomes)

## Key Discussion Points
- (bullet list of main topics discussed)

## Action Items
- (bullet list with owner names if mentioned, e.g., "- [John] Complete the report by Friday")

## Decisions Made
- (bullet list of concrete decisions reached)

## Sentiment & Tone
(1-2 sentences describing the overall meeting tone — collaborative, tense, productive, etc.)

If any section has no relevant content, write "None identified."

---
Transcript:
`;

// ─── Gemini Flash (Primary, Cloud) ──────────────────────────────────────

let genAI = null;

function getGeminiAI() {
  if (!genAI) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'your_gemini_api_key_here') return null;
    genAI = new GoogleGenerativeAI(apiKey);
  }
  return genAI;
}

async function summarizeWithGemini(transcript) {
  const ai = getGeminiAI();
  if (!ai) throw new Error('Gemini API key not configured');

  const model = ai.getGenerativeModel({ model: 'gemini-2.0-flash' });
  const result = await model.generateContent(SUMMARY_PROMPT + transcript);
  const response = await result.response;
  return response.text();
}

// ─── Speaker Analytics ──────────────────────────────────────────────────

function extractSpeakerAnalytics(transcript) {
  const lines = transcript.split('\n').filter(l => l.trim());
  const speakers = {};
  let totalWords = 0;

  for (const line of lines) {
    const match = line.match(/^([A-Za-z]+):\s*(.*)/);
    if (match) {
      const name = match[1];
      const text = match[2];
      const words = text.split(/\s+/).filter(w => w).length;

      if (!speakers[name]) {
        speakers[name] = { name, lines: 0, words: 0 };
      }
      speakers[name].lines += 1;
      speakers[name].words += words;
      totalWords += words;
    } else {
      totalWords += line.split(/\s+/).filter(w => w).length;
    }
  }

  const speakerList = Object.values(speakers).map(s => ({
    ...s,
    percentage: totalWords > 0 ? Math.round((s.words / totalWords) * 100) : 0,
  })).sort((a, b) => b.words - a.words);

  // Calculate a realistic estimated duration (assume ~5 seconds per discrete statement block)
  const estimatedDuration = Math.max(1, Math.round((lines.length * 5) / 60));

  return {
    totalLines: lines.length,
    totalWords,
    speakerCount: speakerList.length,
    speakers: speakerList,
    estimatedDuration,
  };
}

// ─── Main Entry Point ───────────────────────────────────────────────────

async function summarizeTranscript(transcript) {
  let err = null;
  // 1. Try Gemini Flash (cloud, primary)
  try {
    console.log('✨ Summarizing with Gemini 2.0 Flash...');
    const summary = await summarizeWithGemini(transcript);
    return summary;
  } catch (e) {
    err = e;
    console.warn('Gemini failed, using basic fallback:', e.message);
  }

  // 2. Basic fallback (no AI)
  return generateFallbackSummary(transcript, err);
}

function generateFallbackSummary(transcript, errorObj) {
  const analytics = extractSpeakerAnalytics(transcript);
  
  const errorMessage = errorObj ? `API connection failed: ${errorObj.message}` : "A detailed AI summary requires a Gemini API key — set GEMINI_API_KEY in your .env file.";

  return `## Executive Summary
This meeting had ${analytics.speakerCount} participants who discussed ${analytics.totalLines} topics over approximately ${analytics.estimatedDuration} minutes.

> **AI Summary Error:**
> ${errorMessage}

## Key Discussion Points
- ${analytics.totalLines} statements captured across ${analytics.speakerCount} speakers
- Estimated meeting duration: ~${analytics.estimatedDuration} minutes
${analytics.speakers.map(s => `- ${s.name}: ${s.lines} statements (${s.percentage}% of discussion)`).join('\n')}

## Action Items
- Configure GEMINI_API_KEY for AI-powered summaries

## Decisions Made
None identified (AI summarization unavailable).

## Sentiment & Tone
Unable to analyze without AI summarization.`;
}

module.exports = { summarizeTranscript, extractSpeakerAnalytics };
