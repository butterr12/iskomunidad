import Redis from "ioredis";

let redis: Redis | null = null;
let connectionFailed = false;

function getRedis(): Redis | null {
  if (connectionFailed) return null;

  const url = process.env.REDIS_URL;
  if (!url) {
    connectionFailed = true;
    return null;
  }

  if (!redis) {
    redis = new Redis(url, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        if (times > 3) {
          connectionFailed = true;
          return null; // stop retrying
        }
        return Math.min(times * 200, 2000);
      },
      lazyConnect: true,
      enableOfflineQueue: false,
    });
    redis.on("error", (err) => {
      console.error("[abuse/redis] Connection error:", err.message);
    });
    redis.on("connect", () => {
      connectionFailed = false;
    });
    redis.connect().catch(() => {
      connectionFailed = true;
    });
  }
  return redis;
}

// Lua: atomic increment with TTL (only set expiry on first write)
const INCR_SCRIPT = `
local key = KEYS[1]
local ttl = tonumber(ARGV[1])
local count = redis.call('INCR', key)
if count == 1 then
  redis.call('EXPIRE', key, ttl)
end
return count
`;

// Lua: SET NX with TTL for dedup (returns 1 if new, 0 if duplicate)
const DEDUP_SCRIPT = `
local key = KEYS[1]
local ttl = tonumber(ARGV[1])
local result = redis.call('SET', key, '1', 'NX', 'EX', ttl)
if result then
  return 1
else
  return 0
end
`;

/**
 * Atomically increment a counter and return the new count.
 * Returns null if Redis is unavailable.
 */
export async function incrementCounter(
  key: string,
  windowSec: number,
): Promise<number | null> {
  const r = getRedis();
  if (!r) return null;
  try {
    const count = (await r.eval(INCR_SCRIPT, 1, key, windowSec)) as number;
    return count;
  } catch (err) {
    console.error("[abuse/redis] incrementCounter error:", err);
    return null;
  }
}

/**
 * Check for duplicate content. Returns true if content is new, false if duplicate.
 * Returns null if Redis is unavailable.
 */
export async function checkDedup(
  key: string,
  windowSec: number,
): Promise<boolean | null> {
  const r = getRedis();
  if (!r) return null;
  try {
    const result = (await r.eval(DEDUP_SCRIPT, 1, key, windowSec)) as number;
    return result === 1; // true = new, false = duplicate
  } catch (err) {
    console.error("[abuse/redis] checkDedup error:", err);
    return null;
  }
}

/**
 * Log an abuse event to Redis for quick access (capped list).
 */
export async function logAbuseEvent(event: {
  action: string;
  decision: string;
  reason: string;
  userId?: string;
  ipHash?: string;
  timestamp: number;
}): Promise<void> {
  const r = getRedis();
  if (!r) return;
  try {
    const key = "abuse:log";
    await r.lpush(key, JSON.stringify(event));
    await r.ltrim(key, 0, 999); // cap at 1000 entries
    await r.expire(key, 7 * 24 * 60 * 60); // 7 days TTL
  } catch {
    // fire-and-forget
  }
}

/**
 * Delete all rate limit keys matching a pattern for a user.
 */
export async function clearUserCooldowns(userIdHash: string): Promise<number> {
  const r = getRedis();
  if (!r) return 0;
  try {
    const pattern = `abuse:rate:*:userId:${userIdHash}`;
    let cursor = "0";
    let deleted = 0;
    do {
      const [nextCursor, keys] = await r.scan(cursor, "MATCH", pattern, "COUNT", 100);
      cursor = nextCursor;
      if (keys.length > 0) {
        deleted += await r.del(...keys);
      }
    } while (cursor !== "0");
    return deleted;
  } catch {
    return 0;
  }
}
