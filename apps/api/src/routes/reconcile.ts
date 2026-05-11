import type { FastifyInstance } from "fastify";
import { prisma } from "@troasel/db";
import { reconcileCampaignCommissions } from "../services/commission.js";

interface ReconcileQuery {
  campaignId?: string;
  advertiserId?: string;
  periodStart: string; // ISO date
  periodEnd: string;   // ISO date
}

export async function reconcileRoutes(app: FastifyInstance) {
  // GET /api/reconcile?campaignId=&periodStart=&periodEnd=
  // Returns net commission totals per campaign, filterable by advertiser
  app.get<{ Querystring: ReconcileQuery }>(
    "/api/reconcile",
    {
      schema: {
        querystring: {
          type: "object",
          required: ["periodStart", "periodEnd"],
          properties: {
            campaignId: { type: "string" },
            advertiserId: { type: "string" },
            periodStart: { type: "string", format: "date-time" },
            periodEnd: { type: "string", format: "date-time" },
          },
        },
      },
    },
    async (req, reply) => {
      const { campaignId, advertiserId, periodStart, periodEnd } = req.query;

      const start = new Date(periodStart);
      const end = new Date(periodEnd);

      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return reply.status(400).send({ error: "invalid_date_range" });
      }

      // Resolve campaign ids in scope
      const campaigns = await prisma.campaign.findMany({
        where: {
          ...(campaignId ? { id: campaignId } : {}),
          ...(advertiserId ? { advertiserId } : {}),
        },
        select: {
          id: true,
          name: true,
          advertiserId: true,
          bidType: true,
          budgetTotal: true,
          budgetSpent: true,
        },
      });

      const rows = await Promise.all(
        campaigns.map(async (c) => {
          const netCommission = await reconcileCampaignCommissions(c.id, start, end);
          return {
            campaignId: c.id,
            campaignName: c.name,
            advertiserId: c.advertiserId,
            bidType: c.bidType,
            budgetTotal: c.budgetTotal,
            budgetSpent: c.budgetSpent,
            netCommission: netCommission.toFixed(4),
          };
        })
      );

      const grandTotal = rows
        .reduce((sum, r) => sum + parseFloat(r.netCommission), 0)
        .toFixed(4);

      return reply.send({
        periodStart: start.toISOString(),
        periodEnd: end.toISOString(),
        campaigns: rows,
        grandTotal,
      });
    }
  );

  // GET /api/reconcile/events?campaignId=&eventType=&limit=&after=
  // Audit log: raw TrackingEvent rows for a campaign
  app.get(
    "/api/reconcile/events",
    {
      schema: {
        querystring: {
          type: "object",
          required: ["campaignId"],
          properties: {
            campaignId: { type: "string" },
            eventType: { type: "string", enum: ["IMPRESSION", "CLICK", "CONVERSION"] },
            limit: { type: "integer", minimum: 1, maximum: 500, default: 50 },
            after: { type: "string" }, // cursor: last event id
          },
        },
      },
    },
    async (req, reply) => {
      const q = req.query as {
        campaignId: string;
        eventType?: string;
        limit?: number;
        after?: string;
      };

      const events = await prisma.trackingEvent.findMany({
        where: {
          campaignId: q.campaignId,
          ...(q.eventType ? { eventType: q.eventType as any } : {}),
          ...(q.after ? { id: { gt: q.after } } : {}),
        },
        orderBy: { occurredAt: "asc" },
        take: q.limit ?? 50,
        include: {
          commissionEntry: {
            select: { id: true, amount: true, entryType: true },
          },
        },
      });

      return reply.send({
        events,
        nextCursor: events.length > 0 ? events[events.length - 1]?.id : null,
      });
    }
  );
}
