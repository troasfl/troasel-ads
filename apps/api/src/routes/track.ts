import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { v4 as uuidv4 } from "uuid";
import { prisma, EventType, EventSource, CampaignStatus } from "@troasel/db";
import { deduplicateEvent, checkRateLimit } from "../lib/redis.js";
import { recordCommission } from "../services/commission.js";

// 1x1 transparent GIF pixel
const PIXEL_GIF = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64"
);

interface ClickParams {
  clickId: string;
}

interface ImpressionParams {
  impressionId: string;
}

interface ConversionBody {
  clickId: string;
  campaignId: string;
  revenue?: number;
  currency?: string;
}

function extractClientInfo(req: FastifyRequest) {
  return {
    ip: (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() ?? req.ip,
    userAgent: req.headers["user-agent"] ?? null,
    referer: req.headers["referer"] ?? null,
  };
}

async function enforceRateLimit(
  req: FastifyRequest,
  reply: FastifyReply
): Promise<boolean> {
  const ip =
    (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() ??
    req.ip;
  const { allowed } = await checkRateLimit(`trk:${ip}`, 200, 60);
  if (!allowed) {
    reply.status(429).send({ error: "rate_limited" });
    return false;
  }
  return true;
}

export async function trackingRoutes(app: FastifyInstance) {
  // ── Click redirect ────────────────────────────────────────────────────────
  // GET /c/:clickId  → records click event, 302 to destination URL
  app.get<{ Params: ClickParams }>(
    "/c/:clickId",
    { schema: { params: { type: "object", properties: { clickId: { type: "string" } }, required: ["clickId"] } } },
    async (req, reply) => {
      if (!(await enforceRateLimit(req, reply))) return;

      const { clickId } = req.params;
      const client = extractClientInfo(req);

      // Resolve campaign from the encoded clickId (format: {campaignId}_{nonce})
      const [campaignId] = clickId.split("_");
      if (!campaignId) {
        return reply.status(400).send({ error: "invalid_click_id" });
      }

      const campaign = await prisma.campaign.findUnique({
        where: { id: campaignId },
        select: {
          id: true,
          status: true,
          destinationUrl: true,
          endDate: true,
        },
      });

      if (!campaign || campaign.status !== CampaignStatus.ACTIVE) {
        return reply.redirect(302, "https://troasel.com");
      }
      if (campaign.endDate && campaign.endDate < new Date()) {
        return reply.redirect(302, campaign.destinationUrl);
      }

      // Dedup key: campaignId + clickId (full) — prevents same link being hit twice within 30d
      const dedupeKey = `click:${clickId}`;
      const isFirst = await deduplicateEvent(dedupeKey);

      const event = await prisma.trackingEvent.create({
        data: {
          id: uuidv4(),
          campaignId: campaign.id,
          clickId,
          eventType: EventType.CLICK,
          source: EventSource.REDIRECT,
          ip: client.ip,
          userAgent: client.userAgent,
          referer: client.referer,
          isDuplicate: !isFirst,
          dedupeKey: isFirst ? dedupeKey : null,
        },
      });

      if (isFirst) {
        // Fire-and-forget: commission calculation is async to not delay the redirect
        recordCommission(event.id).catch((err) =>
          app.log.error({ err, eventId: event.id }, "commission calculation failed")
        );
      }

      return reply.redirect(302, campaign.destinationUrl);
    }
  );

  // ── Impression pixel (img fallback) ───────────────────────────────────────
  // GET /i/:impressionId.gif  → 1x1 GIF, records impression
  app.get<{ Params: ImpressionParams }>(
    "/i/:impressionId",
    { schema: { params: { type: "object", properties: { impressionId: { type: "string" } }, required: ["impressionId"] } } },
    async (req, reply) => {
      if (!(await enforceRateLimit(req, reply))) return;

      // impressionId format: {campaignId}_{nonce}
      const rawId = req.params.impressionId.replace(/\.gif$/, "");
      const [campaignId] = rawId.split("_");
      const client = extractClientInfo(req);

      if (!campaignId) {
        return reply
          .header("Content-Type", "image/gif")
          .send(PIXEL_GIF);
      }

      const campaign = await prisma.campaign.findUnique({
        where: { id: campaignId },
        select: { id: true, status: true },
      });

      if (campaign && campaign.status === CampaignStatus.ACTIVE) {
        // Dedup: same user-agent + IP + campaign within 1 hour = duplicate impression
        const dedupeKey = `imp:${campaignId}:${client.ip}:${(client.userAgent ?? "").slice(0, 64)}`;
        const isFirst = await deduplicateEvent(dedupeKey, 3600);

        const event = await prisma.trackingEvent.create({
          data: {
            id: uuidv4(),
            campaignId: campaign.id,
            eventType: EventType.IMPRESSION,
            source: EventSource.PIXEL,
            ip: client.ip,
            userAgent: client.userAgent,
            referer: client.referer,
            isDuplicate: !isFirst,
            dedupeKey: isFirst ? dedupeKey : null,
          },
        });

        if (isFirst) {
          recordCommission(event.id).catch((err) =>
            app.log.error({ err, eventId: event.id }, "commission calculation failed")
          );
        }
      }

      return reply
        .header("Content-Type", "image/gif")
        .header("Cache-Control", "no-store, no-cache, must-revalidate")
        .send(PIXEL_GIF);
    }
  );

  // ── Server-side postback (S2S conversion) ─────────────────────────────────
  // POST /api/track/conversion  → authoritative conversion, directly triggers commission
  app.post<{ Body: ConversionBody }>(
    "/api/track/conversion",
    {
      schema: {
        body: {
          type: "object",
          required: ["clickId", "campaignId"],
          properties: {
            clickId: { type: "string" },
            campaignId: { type: "string" },
            revenue: { type: "number", minimum: 0 },
            currency: { type: "string", maxLength: 3 },
          },
        },
      },
    },
    async (req, reply) => {
      if (!(await enforceRateLimit(req, reply))) return;

      const { clickId, campaignId, revenue, currency } = req.body;
      const client = extractClientInfo(req);

      const campaign = await prisma.campaign.findUnique({
        where: { id: campaignId },
        select: { id: true, status: true },
      });

      if (!campaign) {
        return reply.status(404).send({ error: "campaign_not_found" });
      }

      // Dedup: one conversion per clickId (lifetime)
      const dedupeKey = `conv:${clickId}`;
      const isFirst = await deduplicateEvent(dedupeKey, 90 * 24 * 60 * 60);

      const event = await prisma.trackingEvent.create({
        data: {
          id: uuidv4(),
          campaignId: campaign.id,
          clickId,
          eventType: EventType.CONVERSION,
          source: EventSource.S2S,
          ip: client.ip,
          userAgent: client.userAgent,
          conversionRevenue: revenue ?? null,
          conversionCurrency: currency ?? "USD",
          isDuplicate: !isFirst,
          dedupeKey: isFirst ? dedupeKey : null,
        },
      });

      if (isFirst) {
        await recordCommission(event.id);
      }

      return reply.status(201).send({
        eventId: event.id,
        isDuplicate: !isFirst,
        status: isFirst ? "recorded" : "duplicate",
      });
    }
  );
}
