import { z } from "zod";

export const WebhookEventSchema = z.object({
  eventId: z.string().uuid().or(z.string().min(1)),
  eventType: z.enum([
    "order.created",
    "order.updated",
    "shipment.created",
    "order.cancelled",
  ]),
  occurredAt: z.string().datetime(),
  payload: z.object({
    orderId: z.string().min(1),
    status: z.string(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  }),
});

export type WebhookEvent = z.infer<typeof WebhookEventSchema>;
