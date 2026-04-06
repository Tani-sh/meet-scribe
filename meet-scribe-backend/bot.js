/**
 * Bot Wrapper — Spawns Python Chromium Bot
 */

const { spawn } = require('child_process');
const path = require('path');

async function joinMeet(meetUrl, callbacks = {}) {
  const { onStatus, onTranscript, onError, onEnd } = callbacks;

  const isWindows = process.platform === 'win32';
  const pythonExec = path.join(__dirname, 'venv', isWindows ? 'Scripts' : 'bin', isWindows ? 'python.exe' : 'python3');
  const botScript = path.join(__dirname, 'bot.py');

  console.log(`🚀 Launching Python Bot for ${meetUrl}`);
  onStatus?.('launching');

  const child = spawn(pythonExec, [botScript, '--url', meetUrl]);
  
  child.on('error', (err) => {
    console.error(`[Spawn Error] Failed to start python:`, err);
    onError?.(`Local Server Error: Failed to start python. Are you sure the virtual environment exists at /venv? (${err.message})`);
    onEnd?.();
  });

  let stdoutBuffer = '';

  child.stdout.on('data', (data) => {
    stdoutBuffer += data.toString();
    const lines = stdoutBuffer.split('\n');
    stdoutBuffer = lines.pop(); // Keep incomplete line if any

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const msg = JSON.parse(line);
        if (msg.type === 'status') {
          onStatus?.(msg.data);
          console.log(`[Python Status] ${msg.data}`);
        } else if (msg.type === 'transcript') {
          onTranscript?.(msg.data);
        } else if (msg.type === 'error') {
          onError?.(msg.data);
          console.error(`[Python Error Emit] ${msg.data}`);
        }
      } catch (err) {
        console.log(`[Python Log] ${line}`);
      }
    }
  });

  child.stderr.on('data', (data) => {
    console.error(`[Python stderr] ${data.toString()}`);
  });

  child.on('close', (code) => {
    console.log(`Python bot exited with code ${code}`);
    if (code !== 0) {
        // If it exited with code 1 and no error was emitted, emit one
        // onError?.(`Process exited with code ${code}`);
    }
    onEnd?.();
  });
}

module.exports = { joinMeet };
