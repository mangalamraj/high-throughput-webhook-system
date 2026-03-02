import { Worker } from "bullmq";
import { query } from "../db";
import { redisConnection } from "../lib/redis";

const worker = new Worker(
  "webhook-events",
  async (job) => {
    if (job.name === "log-validation-error") {
      const { eventId, reason, payload } = job.data;
      await query(
        "INSERT INTO event_failures (event_id, reason, raw_payload) VALUES ($1, $2, $3)",
        [eventId, reason, JSON.stringify(payload)],
      );
      return;
    }
    const event = job.data;

    const insertEventQuery = `
      INSERT INTO events (id, event_type, order_id, status, payload, occurred_at)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (id) DO NOTHING;
    `;

    try {
      const res = await query(insertEventQuery, [
        event.eventId,
        event.eventType,
        event.payload.orderId,
        event.payload.status,
        JSON.stringify(event.payload),
        event.occurredAt,
      ]);

      if (res.rowCount === 0) {
        console.log(`Skipped duplicate: ${event.eventId}`);
      } else {
        console.log(`Processed event: ${event.eventId}`);
      }
    } catch (err: any) {
      console.error(`Worker Error for ${event.eventId}:`, err.message);

      await query(
        "INSERT INTO event_failures (event_id, reason, raw_payload) VALUES ($1, $2, $3)",
        [event.eventId || "unknown", err.message, JSON.stringify(event)],
      );

      throw err;
    }
  },
  {
    connection: redisConnection as any,
    concurrency: 5,
  },
);

worker.on("active", (job) => {
  console.log(`Job ${job.id} is now active`);
});

worker.on("completed", (job) => {
  console.log(`Job ${job.id} finished`);
});

worker.on("failed", (job, err) => {
  console.error(`Job ${job?.id} failed permanently: ${err.message}`);
});
