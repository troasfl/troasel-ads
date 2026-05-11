import Decimal from "decimal.js";
import {
  prisma,
  BidType,
  EventType,
  EntryType,
  type TrackingEvent,
  type Campaign,
} from "@troasel/db";

// CPM rate: commission per 1000 impressions
const CPM_DIVISOR = new Decimal(1000);

/**
 * Compute the commission amount for a qualifying TrackingEvent.
 * Returns null if the event type doesn't generate commission for this bid model.
 */
export function computeCommission(
  campaign: Pick<Campaign, "bidType" | "bidAmount" | "commissionRate">,
  event: Pick<TrackingEvent, "eventType" | "conversionRevenue">
): Decimal | null {
  const bidType = campaign.bidType;
  const bidAmount = campaign.bidAmount ? new Decimal(campaign.bidAmount) : null;
  const rate = campaign.commissionRate
    ? new Decimal(campaign.commissionRate)
    : null;

  switch (bidType) {
    case BidType.CPC:
      // Commission per click only
      if (event.eventType !== EventType.CLICK) return null;
      if (!bidAmount) throw new Error("CPC campaign missing bidAmount");
      return bidAmount;

    case BidType.CPM:
      // Commission per 1000 impressions
      if (event.eventType !== EventType.IMPRESSION) return null;
      if (!bidAmount) throw new Error("CPM campaign missing bidAmount");
      return bidAmount.div(CPM_DIVISOR);

    case BidType.CPA:
      // Fixed commission per conversion
      if (event.eventType !== EventType.CONVERSION) return null;
      if (!bidAmount) throw new Error("CPA campaign missing bidAmount");
      return bidAmount;

    case BidType.REVENUE_SHARE:
      // % of conversion revenue
      if (event.eventType !== EventType.CONVERSION) return null;
      if (!rate) throw new Error("REVENUE_SHARE campaign missing commissionRate");
      if (!event.conversionRevenue) return null;
      return new Decimal(event.conversionRevenue).mul(rate);

    default:
      return null;
  }
}

/**
 * Record a commission entry for a qualifying, non-duplicate TrackingEvent.
 * Idempotent: skips if a CommissionEntry already exists for this event.
 * Also enforces budget cap: does not write commission if campaign budget is exhausted.
 */
export async function recordCommission(eventId: string): Promise<void> {
  const event = await prisma.trackingEvent.findUniqueOrThrow({
    where: { id: eventId },
    include: { campaign: true },
  });

  if (event.isDuplicate) return;

  // Idempotency guard
  const existing = await prisma.commissionEntry.findUnique({
    where: { trackingEventId: eventId },
  });
  if (existing) return;

  const amount = computeCommission(event.campaign, event);
  if (!amount) return; // event type doesn't match bid model

  // Budget cap check
  const spent = new Decimal(event.campaign.budgetSpent);
  const total = new Decimal(event.campaign.budgetTotal);
  if (spent.add(amount).greaterThan(total)) {
    // Campaign budget exhausted — don't bill, log as duplicate-equivalent
    await prisma.trackingEvent.update({
      where: { id: eventId },
      data: { isDuplicate: true },
    });
    return;
  }

  // Atomic write: commission entry + update budgetSpent
  await prisma.$transaction([
    prisma.commissionEntry.create({
      data: {
        campaignId: event.campaignId,
        trackingEventId: eventId,
        entryType: EntryType.EARN,
        amount: amount.toFixed(10),
      },
    }),
    prisma.campaign.update({
      where: { id: event.campaignId },
      data: { budgetSpent: { increment: amount.toNumber() } },
    }),
  ]);
}

/**
 * Reconciliation: sum net commission (EARN minus REVERSAL) by campaign for a period.
 */
export async function reconcileCampaignCommissions(
  campaignId: string,
  periodStart: Date,
  periodEnd: Date
): Promise<Decimal> {
  const entries = await prisma.commissionEntry.findMany({
    where: {
      campaignId,
      computedAt: { gte: periodStart, lte: periodEnd },
    },
    select: { amount: true, entryType: true },
  });

  return entries.reduce((sum, e) => {
    const amt = new Decimal(e.amount);
    // EARN rows have positive amounts, REVERSAL rows have negative amounts stored directly
    return sum.add(amt);
  }, new Decimal(0));
}
