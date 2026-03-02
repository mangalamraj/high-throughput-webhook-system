import cors from "cors";
import express from "express";
import dotenv from "dotenv";
import { connectToDatabase } from "./db";
import { createEventsTables } from "./schema";
import { Queue } from "bullmq";
import { WebhookEventSchema } from "./validation";
import { redisConnection } from "./lib/redis";
import { query } from "./db";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

const eventQueue = new Queue("webhook-events", {
  connection: redisConnection as any,
});

app.post("/api/v1/webhooks", async (req, res) => {
  const result = WebhookEventSchema.safeParse(req.body);

  if (!result.success) {
    const errorDetails = result.error.flatten().fieldErrors;

    await eventQueue.add("log-validation-error", {
      eventId: req.body.eventId || `val-err-${Date.now()}`,
      reason: `Zod Validation Failed: ${JSON.stringify(errorDetails)}`,
      payload: req.body,
    });
    return res.status(400).json({ error: result.error.format() });
  }

  await eventQueue.add("process-webhook", result.data, {
    jobId: result.data.eventId,
    attempts: 5,
    backoff: { type: "exponential", delay: 1000 },
  });

  return res
    .status(202)
    .json({ status: "accepted", eventId: result.data.eventId });
});

app.get("/api/v1/stats", async (req, res) => {
  try {
    const countsResult = await query(`
      SELECT
        (SELECT COUNT(*) FROM events) as processed,
        (SELECT COUNT(*) FROM event_failures) as failed
    `);

    const processed = parseInt(countsResult.rows[0].processed);
    const failed = parseInt(countsResult.rows[0].failed);
    const received = processed + failed;

    const breakdownResult = await query(`
      SELECT event_type as type, COUNT(*) as count
      FROM events
      GROUP BY event_type
    `);

    const timeSeriesResult = await query(`
      SELECT
        to_char(date_trunc('minute', occurred_at), 'HH24:MI') as minute,
        COUNT(*) as count
      FROM events
      WHERE occurred_at > NOW() - INTERVAL '30 minutes'
      GROUP BY date_trunc('minute', occurred_at)
      ORDER BY date_trunc('minute', occurred_at) ASC
    `);

    const failuresResult = await query(`
      SELECT
        id,
        event_id as "eventId",
        reason,
        to_char(created_at, 'HH24:MI:SS') as timestamp,
        (raw_payload->>'eventType') as type -- Extracting type from saved JSONB
      FROM event_failures
      ORDER BY created_at DESC
    `);

    res.json({
      received,
      processed,
      failed,
      breakdown: breakdownResult.rows.map((row) => ({
        type: row.type,
        count: parseInt(row.count),
      })),
      timeSeries: timeSeriesResult.rows.map((row) => ({
        minute: row.minute,
        count: parseInt(row.count),
      })),
      recentFailures: failuresResult.rows,
    });
  } catch (error: any) {
    console.error("Stats API Error:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

const PORT = process.env.PORT || 8000;

connectToDatabase()
  .then(() => {
    createEventsTables();
  })
  .catch((err) => {
    console.log("Error while making the events table", err);
  });
app.listen(PORT, () => {
  console.log("Server is running on port", PORT);
});
