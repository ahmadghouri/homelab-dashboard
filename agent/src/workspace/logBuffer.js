import { open } from 'node:fs/promises';
import { StringDecoder } from 'node:string_decoder';

// Ring buffer of the last output lines of one managed project, plus a helper to read the tail
// of a project's own log file.

export const MAX_BUFFER_LINES = 1000;
export const MAX_LINE_LENGTH = 2000;
const LOG_FILE_TAIL_BYTES = 64 * 1024;
const ERROR_PATTERN = /\b(error|exception|fatal|unhandled|ERR!|failed)\b/i;

function cleanLine(text) {
  return text.replace(/\r$/, '').slice(0, MAX_LINE_LENGTH);
}

export function isErrorLine(text) {
  return ERROR_PATTERN.test(text);
}

export function createLogBuffer(maxLines = MAX_BUFFER_LINES) {
  const lines = [];
  // Text after the last newline of each stream, kept until the line is complete.
  const pending = { stdout: '', stderr: '' };
  const decoders = { stdout: new StringDecoder('utf8'), stderr: new StringDecoder('utf8') };

  function addLine(stream, text) {
    lines.push({ ts: new Date().toISOString(), stream, text: cleanLine(text) });
    if (lines.length > maxLines) {
      lines.splice(0, lines.length - maxLines);
    }
  }

  // Accepts raw bytes (or text) from a stream and stores every complete line.
  function write(stream, chunk) {
    const text = typeof chunk === 'string' ? chunk : decoders[stream].write(chunk);
    const parts = (pending[stream] + text).split('\n');
    pending[stream] = parts.pop() ?? '';
    for (const part of parts) {
      addLine(stream, part);
    }
    // A very long line without a newline is stored in pieces instead of growing forever.
    if (pending[stream].length > MAX_LINE_LENGTH) {
      addLine(stream, pending[stream]);
      pending[stream] = '';
    }
  }

  // Stores unfinished lines, for example when the process has exited.
  function flush() {
    for (const stream of ['stdout', 'stderr']) {
      const rest = pending[stream] + decoders[stream].end();
      pending[stream] = '';
      if (rest) {
        addLine(stream, rest);
      }
    }
  }

  return {
    write,
    flush,
    // Adds a line written by the agent itself (start / exit notes).
    note(stream, text) {
      addLine(stream, text);
    },
    tail(count) {
      return lines.slice(-count);
    },
    errorCount() {
      return lines.reduce((total, line) => total + (isErrorLine(line.text) ? 1 : 0), 0);
    },
  };
}

// Reads the last 64 KB of a log file and returns its last `count` lines.
// A missing or unreadable file gives an empty list and an error message.
export async function readLogFileTail(filePath, count) {
  let handle;
  try {
    handle = await open(filePath, 'r');
    const { size } = await handle.stat();
    const length = Math.min(size, LOG_FILE_TAIL_BYTES);
    const buffer = Buffer.alloc(length);
    await handle.read(buffer, 0, length, size - length);
    const parts = buffer.toString('utf8').split('\n');
    // The first piece is usually cut in the middle when the file is larger than the tail.
    if (size > length) {
      parts.shift();
    }
    if (parts.at(-1) === '') {
      parts.pop();
    }
    const lines = parts
      .slice(-count)
      .map((text) => ({ ts: null, stream: 'file', text: cleanLine(text) }));
    return { lines, error: null };
  } catch (error) {
    const message = error.code === 'ENOENT' ? 'Log file not found' : 'Could not read the log file';
    return { lines: [], error: message };
  } finally {
    await handle?.close();
  }
}
