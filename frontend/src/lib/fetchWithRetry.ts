// Shared 429 retry-with-backoff for GET requests. Every *Api.ts file's fetch
// wrapper throws immediately on 429 today with no retry, so a burst of reads
// (e.g. several stats panels refetching off one bridge event) permanently
// fails instead of just slowing down. Mutations (POST/PATCH/DELETE/PUT) are
// NEVER retried here — an automatic retry on a write could double-submit
// (double-charge a refund, double-create a record) if the first attempt
// actually succeeded server-side but the response was lost/delayed.
//
// Drop-in replacement for the global fetch — same signature, same Response
// return type. Existing call sites just swap `fetch(...)` for
// `fetchWithRetry(...)`.

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 500;

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function fetchWithRetry(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const method = (init?.method ?? 'GET').toUpperCase();
  if (method !== 'GET') return fetch(input, init);

  let attempt = 0;
  for (;;) {
    const res = await fetch(input, init);
    if (res.status !== 429 || attempt >= MAX_RETRIES) return res;

    attempt++;
    const retryAfterHeader = res.headers.get('Retry-After');
    const retryAfterMs = retryAfterHeader ? Number(retryAfterHeader) * 1000 : NaN;
    const delay = Number.isFinite(retryAfterMs) ? retryAfterMs : BASE_DELAY_MS * 2 ** (attempt - 1);
    await sleep(delay);
  }
}
