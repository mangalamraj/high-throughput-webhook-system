import cors from "cors";
import express from "express";
import dotenv from "dotenv";
import { connectToDatabase } from "./db";
import { createEventsTables } from "./schema";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

app.get("/api/stats", async (req, res) => {
  const stats = {
    received: 1000,
    processed: 950,
    failed: 50,
    breakdown: [
      { type: "order.created", count: 400 },
      { type: "order.updated", count: 300 },
    ],
    timeSeries: [
      { minute: "12:01", count: 12 },
      { minute: "12:02", count: 18 },
    ],
    recentFailures: [
      {
        id: 1,
        eventId: "evt_abc",
        type: "order.created",
        reason: "DB Timeout",
        timestamp: "12:05:01",
      },
    ],
  };
  res.json(stats);
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
