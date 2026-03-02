# High-Throughput Webhook Ingestion System

A robust, horizontally scalable webhook processing system designed to handle high-traffic bursts with guaranteed delivery, idempotency, and real-time observability.

## Architecture and Design Decisions

* Asynchronous Processing: Uses BullMQ (Redis) to decouple the ingestion "Hot Path" from database persistence. This ensures that even if PostgreSQL experiences latency, the API remains responsive.  
* Layered Idempotency: Prevents duplicate processing using a two-tier defense:  
  * Queue Level: BullMQ jobId deduplication.  
  * Database Level: PostgreSQL ON CONFLICT DO NOTHING.  
* Fault Tolerance: Implements Exponential Backoff (5 attempts) for failed jobs.  
* Async Error Logging: Validation failures are pushed to the queue asynchronously as log-validation-error jobs. This maintains low API latency, ensuring that the "Hot Path" is never blocked by slow I/O operations.
<img width="1152" height="182" alt="Screenshot 2026-03-02 at 22 33 47" src="https://github.com/user-attachments/assets/6985e2b8-90e0-4c29-990b-a430e671cd89" />

## Tech Stack

* Backend: Node.js, Express, TypeScript.  
* Validation: Zod (Strict schema enforcement).  
* Queueing: BullMQ + Redis.  
* Database: PostgreSQL (OLTP) with an evolution path to ClickHouse for OLAP scaling.  
* Frontend: Nextjs, Tailwind CSS, Shadcn/UI, Recharts.

## Getting Started
### 1. Prerequisites

* Docker Desktop: (Must be running for Redis/Postgres)  
* Node.js: v18+

### 2. Infrastructure Setup

```bash
# Start Redis and PostgreSQL  
docker run --name webhook-redis -p 6379:6379 -d redis
docker run -d \
  --name postgres-db \
  -e POSTGRES_DB="" \
  -e POSTGRES_USER="" \
  -e POSTGRES_PASSWORD="" \
  -p 5432:5432 \
  postgres:16

```

### 3. Server Configuration

ENV for server
```bash
PORT=8000

PG_DATABASE=
PG_USER=
PG_PASSWORD=
PG_HOST=
PG_PORT=

```

your database credentials.  

```bash
cd server  
pnpm install  
# Run API and Worker simultaneously using concurrently  
pnpm run dev

# Run the script
pnpm run test:load
```

### 4. Dashboard Setup

```bash
cd dashboard  
pnpm install  
pnpm run dev
```

## Core Logic Snippets

### The Ingestor (API)

The API validates the schema via Zod. If it fails, it pushes a failure log to the queue. If it succeeds, it pushes the event for processing.  

```typescript
app.post("/api/v1/webhooks", async (req, res) => {  
  const result = WebhookEventSchema.safeParse(req.body);

  if (!result.success) {  
    await eventQueue.add("log-validation-error", {  
      eventId: req.body.eventId || `val-${Date.now()}`,  
      reason: `Zod Error: ${JSON.stringify(result.error.flatten().fieldErrors)}`,  
      payload: req.body  
    });  
    return res.status(400).json({ error: result.error.format() });  
  }

  await eventQueue.add("process-webhook", result.data, {  
    jobId: result.data.eventId,  
    attempts: 5,  
    backoff: { type: "exponential", delay: 1000 },  
  });

  return res.status(202).json({ status: "accepted" });  
});
```

### The Worker
Handles both successful event storage and failure logging in a non-blocking way.  

```typescript
const worker = new Worker("webhook-events", async (job) => {  
  if (job.name === "log-validation-error") {  
    const { eventId, reason, payload } = job.data;  
    return await query("INSERT INTO event_failures (event_id, reason, raw_payload) VALUES ($1, $2, $3)", [eventId, reason, JSON.stringify(payload)]);  
  }

  const event = job.data;  
  try {  
    await query("INSERT INTO events (id, event_type, order_id, status, payload, occurred_at) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (id) DO NOTHING", [event.eventId, event.eventType, event.payload.orderId, event.payload.status, JSON.stringify(event.payload), event.occurredAt]);  
  } catch (err: any) {  
    await query("INSERT INTO event_failures (event_id, reason, raw_payload) VALUES ($1, $2, $3)", [event.eventId, err.message, JSON.stringify(event)]);  
    throw err;  
  }  
}, { connection: redisConnection as any, concurrency: 5 });
```


## Scaling Roadmap (V2)
If got more time i would have implemented other bonus parts.

* OLAP Integration: Migrating time-series aggregations to ClickHouse using a dual-write or CDC pattern to handle millions of events without locking PostgreSQL.  
* Edge Ingestion: Moving the ingestion layer to Cloudflare Workers + Cloudflare Queues to reduce global latency.  
* Dead-Letter Replay: Implementing a manual "Replay" utility to re-queue failed events directly from the event_failures table.
* Made everything in websockets
* implemented batching in queue
* made better folder structure in frontend breaking everything in components and better state manangements
