/**
 * Demo Bot — Simulates a Google Meet session with realistic transcript data
 * Used for portfolio demos when Google Meet's anti-bot measures block the real bot.
 * The real bot (bot.js) will work when signed into a Google account or using Meet API.
 */

const DEMO_TRANSCRIPT = [
  { speaker: 'Alice', text: "Good morning everyone, let's get started with the sprint planning.", delay: 2000 },
  { speaker: 'Bob', text: "Sure. I finished the authentication module last week. All tests are passing.", delay: 3500 },
  { speaker: 'Alice', text: "Great work Bob. What about the API integration?", delay: 2500 },
  { speaker: 'Carol', text: "I've been working on the REST API endpoints. The user CRUD operations are done.", delay: 3000 },
  { speaker: 'Carol', text: "Still need to add pagination and filtering to the list endpoints though.", delay: 3000 },
  { speaker: 'Alice', text: "How long do you think that will take?", delay: 2000 },
  { speaker: 'Carol', text: "Probably two days. I also want to add rate limiting.", delay: 2500 },
  { speaker: 'Bob', text: "I can help with rate limiting. I implemented that in our other project.", delay: 3000 },
  { speaker: 'Alice', text: "Perfect. Bob, can you pair with Carol on that? Now let's discuss the frontend.", delay: 4000 },
  { speaker: 'Dave', text: "The dashboard is looking good. I finished the charts and the real-time updates.", delay: 3500 },
  { speaker: 'Dave', text: "I'm using WebSocket for live data streaming. Works really smooth.", delay: 3000 },
  { speaker: 'Alice', text: "Nice. Any blockers anyone wants to raise?", delay: 2000 },
  { speaker: 'Bob', text: "One thing — we need to decide on the database migration strategy before next week.", delay: 3500 },
  { speaker: 'Carol', text: "Agreed. Should we use an ORM or write raw SQL migrations?", delay: 2500 },
  { speaker: 'Alice', text: "Let's discuss that in a separate meeting. I'll schedule it for tomorrow.", delay: 3000 },
  { speaker: 'Alice', text: "Any other topics? No? Alright, great meeting everyone. See you tomorrow!", delay: 3000 },
  { speaker: 'Bob', text: "Thanks Alice. See you all!", delay: 1500 },
  { speaker: 'Carol', text: "Bye everyone!", delay: 1500 },
];

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Simulate a Google Meet session with realistic transcript
 */
async function joinMeetDemo(meetUrl, callbacks = {}) {
  const { onStatus, onTranscript, onError, onEnd } = callbacks;

  try {
    onStatus?.('launching');
    console.log('🎭 [DEMO] Starting simulated meeting session...');
    await delay(1500);

    onStatus?.('navigating');
    console.log(`🎭 [DEMO] Simulating navigation to ${meetUrl}...`);
    await delay(2000);

    onStatus?.('joining');
    console.log('🎭 [DEMO] Joining meeting as "AI Scribe Bot"...');
    await delay(3000);

    onStatus?.('listening');
    console.log('🎭 [DEMO] Now listening — streaming transcript...');

    // Stream transcript chunks with realistic timing
    for (const entry of DEMO_TRANSCRIPT) {
      await delay(entry.delay);
      const line = `${entry.speaker}: ${entry.text}`;
      console.log(`📝 [DEMO] ${line}`);
      onTranscript?.(line);
    }

    // Meeting ends
    await delay(2000);
    console.log('🎭 [DEMO] Meeting ended. Generating summary...');
    onEnd?.();

  } catch (err) {
    console.error('❌ Demo error:', err.message);
    onError?.(err.message);
  }
}

module.exports = { joinMeetDemo, DEMO_TRANSCRIPT };
