import axios from "axios";

const API_URL = "http://localhost:8000/api/v1/webhooks";
const TOTAL_EVENTS = 500;
const CONCURRENCY = 20;

const eventTypes = [
  "order.created",
  "order.updated",
  "shipment.created",
  "order.cancelled",
];

async function runTest() {
  console.log("Initializing internal load test...");
  const startTime = Date.now();

  const sendRequest = async (index: number) => {
    // duplicates
    const eventId =
      index % 10 === 0
        ? `repeat-id-${index}`
        : `evt-${Math.random().toString(36).substr(2, 9)}`;
    // Intentional failure
    const eventType =
      index % 20 === 0 ? "" : eventTypes[index % eventTypes.length];

    try {
      await axios.post(API_URL, {
        eventId,
        eventType,
        occurredAt: new Date().toISOString(),
        payload: {
          orderId: `ORD-${index}`,
          status: "testing",
          metadata: {
            source: "load-tester",
            environment: "local",
            retryCount: 0,
            ipAddress: "127.0.0.1",
            userAgent: "axios",
            correlationId: `corr-${eventId}`,
          },
        },
      });
    } catch (e: any) {
      console.error(`Unexpected Error at event ${eventId}:`, e.message);
    }
  };

  for (let i = 0; i < TOTAL_EVENTS; i += CONCURRENCY) {
    const batch = Array.from({ length: CONCURRENCY }).map((_, j) =>
      sendRequest(i + j),
    );
    await Promise.all(batch);
  }

  console.log(
    `Finished! Sent ${TOTAL_EVENTS} events in ${(Date.now() - startTime) / 1000}s`,
  );
}

runTest();
