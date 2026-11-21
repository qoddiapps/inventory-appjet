const WINDOW_MS = 15 * 60_000;
const MAX_FAILURES_PER_CLIENT = 5;
const MAX_FAILURES_GLOBAL = 100;
const MAX_TRACKED_CLIENTS = 1_000;

type FailureBucket = {
  failures: number;
  resetAt: number;
};

const clients = new Map<string, FailureBucket>();
let globalFailures: FailureBucket = { failures: 0, resetAt: 0 };

export const LOGIN_RATE_LIMIT_WINDOW_MS = WINDOW_MS;
export const LOGIN_RATE_LIMIT_MAX_FAILURES = MAX_FAILURES_PER_CLIENT;

function currentBucket(bucket: FailureBucket | undefined, now: number): FailureBucket | undefined {
  return bucket && bucket.resetAt > now ? bucket : undefined;
}

function retryAfterSeconds(resetAt: number, now: number): number {
  return Math.max(1, Math.ceil((resetAt - now) / 1000));
}

export function checkLoginRateLimit(clientId: string): {
  allowed: boolean;
  retryAfterSeconds: number;
} {
  const now = Date.now();
  const client = currentBucket(clients.get(clientId), now);
  const global = currentBucket(globalFailures, now);
  const clientBlocked = Boolean(client && client.failures >= MAX_FAILURES_PER_CLIENT);
  const globalBlocked = Boolean(global && global.failures >= MAX_FAILURES_GLOBAL);

  if (!clientBlocked && !globalBlocked) {
    return { allowed: true, retryAfterSeconds: 0 };
  }

  const resetAt = Math.max(
    clientBlocked && client ? client.resetAt : 0,
    globalBlocked && global ? global.resetAt : 0,
  );
  return { allowed: false, retryAfterSeconds: retryAfterSeconds(resetAt, now) };
}

export function recordLoginFailure(clientId: string): void {
  const now = Date.now();
  if (globalFailures.resetAt <= now) {
    globalFailures = { failures: 0, resetAt: now + WINDOW_MS };
  }
  globalFailures.failures += 1;

  const client = currentBucket(clients.get(clientId), now);
  if (client) {
    client.failures += 1;
    return;
  }

  if (clients.size >= MAX_TRACKED_CLIENTS) {
    for (const [key, bucket] of clients) {
      if (bucket.resetAt <= now) clients.delete(key);
    }
  }

  clients.set(clientId, { failures: 1, resetAt: now + WINDOW_MS });
}

export function resetLoginFailures(clientId: string): void {
  clients.delete(clientId);
  globalFailures = { failures: 0, resetAt: 0 };
}

/**
 * Use the leftmost X-Forwarded-For value when the hosting proxy overwrites it.
 * The global failure bucket still bounds attempts when a client can spoof a
 * source address, so rotating headers cannot remove the overall ceiling.
 */
export function loginClientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const firstForwarded = forwarded?.split(",", 1)[0]?.trim();
  const candidate = firstForwarded || request.headers.get("x-real-ip")?.trim() || "unknown";
  return candidate.slice(0, 128);
}

/** Test-only reset; this module is not exposed through an HTTP route. */
export function resetLoginRateLimitForTests(): void {
  clients.clear();
  globalFailures = { failures: 0, resetAt: 0 };
}
