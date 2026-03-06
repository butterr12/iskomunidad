type CounterEntry = {
  count: number;
  resetAt: number;
};

const counterStore = new Map<string, CounterEntry>();
const dedupStore = new Map<string, number>();

function pruneExpired(now: number): void {
  for (const [key, entry] of counterStore) {
    if (now >= entry.resetAt) {
      counterStore.delete(key);
    }
  }

  for (const [key, expiresAt] of dedupStore) {
    if (now >= expiresAt) {
      dedupStore.delete(key);
    }
  }
}

const SWEEP_INTERVAL_MS = 60_000;
const sweepTimer = setInterval(() => {
  pruneExpired(Date.now());
}, SWEEP_INTERVAL_MS);
sweepTimer.unref();

export async function incrementCounter(
  key: string,
  windowSec: number,
): Promise<number> {
  const now = Date.now();
  const windowMs = windowSec * 1000;
  const entry = counterStore.get(key);

  if (!entry || now >= entry.resetAt) {
    counterStore.set(key, { count: 1, resetAt: now + windowMs });
    return 1;
  }

  entry.count += 1;
  return entry.count;
}

export async function checkDedup(
  key: string,
  windowSec: number,
): Promise<boolean> {
  const now = Date.now();
  const expiresAt = dedupStore.get(key);

  if (expiresAt && now < expiresAt) {
    return false;
  }

  dedupStore.set(key, now + windowSec * 1000);
  return true;
}

export async function clearUserCooldowns(userIdHash: string): Promise<number> {
  const suffix = `:userId:${userIdHash}`;
  const now = Date.now();
  let deleted = 0;

  for (const [key, entry] of counterStore) {
    if (now >= entry.resetAt) {
      counterStore.delete(key);
      continue;
    }

    if (key.startsWith("abuse:rate:") && key.endsWith(suffix)) {
      counterStore.delete(key);
      deleted += 1;
    }
  }

  return deleted;
}
