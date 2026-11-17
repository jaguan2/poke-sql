// Kept independent of Electron: the generated service worker uses the same
// parser so cached web audio and desktop audio agree on single byte ranges.
function parseByteRange(header, length) {
  const match = /^bytes=(\d*)-(\d*)$/.exec(header);
  if (!match || (!match[1] && !match[2]) || length === 0) return null;
  const first = match[1] ? Number(match[1]) : undefined;
  const last = match[2] ? Number(match[2]) : undefined;
  if ((first !== undefined && !Number.isSafeInteger(first)) || (last !== undefined && !Number.isSafeInteger(last))) return null;
  const start = first ?? Math.max(0, length - last);
  const end = first === undefined || last === undefined ? length - 1 : Math.min(last, length - 1);
  return start < length && start <= end ? { start, end } : null;
}

module.exports = { parseByteRange };
