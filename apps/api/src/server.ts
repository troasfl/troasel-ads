import Fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import { redis } from "./lib/redis.js";
import { trackingRoutes } from "./routes/track.js";
import { reconcileRoutes } from "./routes/reconcile.js";

const app = Fastify({
  logger: {
    level: process.env["LOG_LEVEL"] ?? "info",
    transport:
      process.env["NODE_ENV"] === "development"
        ? { target: "pino-pretty" }
        : undefined,
  },
});

await app.register(cors, {
  origin: process.env["CORS_ORIGIN"] ?? "*",
  methods: ["GET", "POST", "OPTIONS"],
});

await app.register(rateLimit, {
  global: false, // per-route rate limiting handled in route handlers via Redis
  redis: redis as any,
});

// Health check (no auth required)
app.get("/health", async (_req, reply) => {
  return reply.send({ status: "ok", ts: new Date().toISOString() });
});

await app.register(trackingRoutes);
await app.register(reconcileRoutes);

const port = parseInt(process.env["PORT"] ?? "3001", 10);
const host = process.env["HOST"] ?? "0.0.0.0";

try {
  await app.listen({ port, host });
  app.log.info({ port, host }, "Troasel Ads API listening");
} catch (err) {
  app.log.fatal(err, "Failed to start server");
  process.exit(1);
}

export { app };
