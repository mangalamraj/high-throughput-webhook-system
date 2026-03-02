import Redis from "ioredis";

export const redisConnection = new Redis({
  host: "127.0.0.1",
  port: 6379,
  maxRetriesPerRequest: null,
});

redisConnection.on("error", (err) => {
  console.error("Redis Connection Error:", err.message);
});

redisConnection.on("connect", () => {
  console.log("Connected to Redis!");
});
