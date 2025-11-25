import Redis from "ioredis";

const redisClient = new Redis({
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT || "6379"),
  password: process.env.REDIS_PASSWORD,
  retryStrategy: (times: number) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  maxRetriesPerRequest: 3,
});

redisClient.on("error", (err) => {
  console.error("[Redis] Connection error:", err);
});

redisClient.on("connect", () => {
  console.log("[Redis] Connected successfully.");
});

export async function getCached<T>(key: string): Promise<T | null> {
  try {
    const cached = await redisClient.get(key);
    if (!cached) return null;
    return JSON.parse(cached) as T;
  } catch (err) {
    console.error("[Redis] Get error:", err);
    return null;
  }
}

export async function setCached<T>(
  key: string,
  value: T,
  ttl: number = 300
): Promise<void> {
  try {
    await redisClient.setex(key, ttl, JSON.stringify(value));
  } catch (err) {
    console.error("[Redis] Set error:", err);
  }
}

export async function deleteCached(key: string): Promise<void> {
  try {
    await redisClient.del(key);
  } catch (err) {
    console.error("[Redis] Delete error:", err);
  }
}

export async function clearCacheByPattern(pattern: string): Promise<void> {
  try {
    const keys = await redisClient.keys(pattern);
    if (keys.length > 0) {
      await redisClient.del(...keys);
    }
  } catch (err) {
    console.error("[Redis] Clear pattern error:", err);
  }
}

export { redisClient };
export default redisClient;
