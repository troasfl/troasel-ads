import { NextResponse } from "next/server";
import { requireAdvertiser } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const advertiser = await requireAdvertiser();
    const { id } = await params;

    const campaign = await db.campaign.findUnique({ where: { id } });
    if (!campaign || campaign.advertiserId !== advertiser.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const [impressions, clicks, conversions, commissionTotal] =
      await Promise.all([
        db.trackingEvent.count({
          where: { campaignId: id, eventType: "IMPRESSION", isDuplicate: false },
        }),
        db.trackingEvent.count({
          where: { campaignId: id, eventType: "CLICK", isDuplicate: false },
        }),
        db.trackingEvent.count({
          where: { campaignId: id, eventType: "CONVERSION", isDuplicate: false },
        }),
        db.commissionEntry.aggregate({
          where: { campaignId: id },
          _sum: { amount: true },
        }),
      ]);

    const spend = Number(campaign.budgetSpent);
    const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;

    return NextResponse.json({
      performance: {
        impressions,
        clicks,
        conversions,
        spend,
        commission: Number(commissionTotal._sum.amount ?? 0),
        ctr: Math.round(ctr * 100) / 100,
      },
    });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
