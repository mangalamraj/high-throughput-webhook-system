import { query } from "../db";

export const createEventsTables = async () => {
  const createTablesQuery = `
    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      event_type VARCHAR(50) NOT NULL,
      order_id VARCHAR(255) NOT NULL,
      status VARCHAR(50) NOT NULL,
      payload JSONB NOT NULL,
      occurred_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS event_failures (
      id SERIAL PRIMARY KEY,
      event_id TEXT,
      reason TEXT NOT NULL,
      raw_payload JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_events_occurred_at ON events(occurred_at);
  `;

  try {
    await query(createTablesQuery);
    console.info("Events and Failure tables ready!");
  } catch (error: any) {
    console.error("Error while creating webhook tables:", error.message);
    throw error;
  }
};
