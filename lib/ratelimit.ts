import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";
import { env } from "./env";
import { LIMITS } from "./limits";

let redisInstance: Redis | null = null;
let uploadRateLimiter: Ratelimit | null = null;
let joinRateLimiter: Ratelimit | null = null;

export function getRedis() {
  if (!redisInstance) {
    redisInstance = new Redis({
      url: env.upstashRedisRestUrl,
      token: env.upstashRedisRestToken,
    });
  }
  return redisInstance;
}

export function getUploadRateLimiter() {
  if (!uploadRateLimiter) {
    uploadRateLimiter = new Ratelimit({
      redis: getRedis(),
      limiter: Ratelimit.slidingWindow(LIMITS.UPLOAD_LIMIT_FILES_PER_MIN, "1 m"),
      analytics: true,
      prefix: "drop:ratelimit:upload",
    });
  }
  return uploadRateLimiter;
}

export function getJoinRateLimiter() {
  if (!joinRateLimiter) {
    joinRateLimiter = new Ratelimit({
      redis: getRedis(),
      limiter: Ratelimit.slidingWindow(LIMITS.JOIN_LIMIT_PER_MIN, "1 m"),
      analytics: true,
      prefix: "drop:ratelimit:join",
    });
  }
  return joinRateLimiter;
}
