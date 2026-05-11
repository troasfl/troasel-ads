import { NextResponse } from "next/server";
import { requireAdvertiser } from "@/lib/auth";
import { db } from "@/lib/db";

function csvRow(cells: (string | number)[]): string {
  return cells.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",");
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const advertiser = await requireAdvertiser();
    const { id } = await params;
    const { searchParams } = new URL(req.url);

    const campaign = await db.campaign.findUnique({ where: { id } });
    if (!campaign || campaign.advertiserId !== advertiser.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const fromRaw = searchParams.get("from");
    const toRaw = searchParams.get("to");
    const fromDate = fromRaw ? new Date(fromRaw) : undefined;
    const toDate = toRaw ? new Date(toRaw + "T23:59:59.999Z") : undefined;

    const eventDateFilter =
      fromDate || toDate
        ? {
            occurredAt: {
              ...(fromDate && { gte: fromDate }),
              ...(toDate && { lte: toDate }),
            },
          }
        : {};
    const commDateFilter =
      fromDate || toDate
        ? {
            computedAt: {
              ...(fromDate && { gte: fromDate }),
              ...(toDate && { lte: toDate }),
            },
          }
        : {};

    const [impressions, clicks, conversions, commissionAgg] = await Promise.all([
      db.trackingEvent.count({
        where: { campaignId: id, eventType: "IMPRESSION", isDuplicate: false, ...eventDateFilter },
      }),
      db.trackingEvent.count({
        where: { campaignId: id, eventType: "CLICK", isDuplicate: false, ...eventDateFilter },
      }),
      db.trackingEvent.count({
        where: { campaignId: id, eventType: "CONVERSION", isDuplicate: false, ...eventDateFilter },
      }),
      db.commissionEntry.aggregate({
        where: { campaignId: id, ...commDateFilter },
        _sum: { amount: true },
      }),
    ]);

    const commission = Number(commissionAgg._sum.amount ?? 0);
    const spend = fromDate || toDate ? commission : Number(campaign.budgetSpent);
    const ctr = impressions > 0 ? ((clicks / impressions) * 100).toFixed(2) : "0.00";

    const headers = [
      "Campaign",
      "Date From",
      "Date To",
      "Impressions",
      "Clicks",
      "CTR (%)",
      "Conversions",
      "Spend ($)",
      "Commission ($)",
    ];
    const data = [
      campaign.name,
      fromRaw ?? "all time",
      toRaw ?? "all time",
      impressions,
      clicks,
      ctr,
      conversions,
      spend.toFixed(2),
      commission.toFixed(2),
    ];

    const csv = [csvRow(headers), csvRow(data)].join("\n");
    const filename = `campaign-${campaign.name.replace(/[^a-z0-9]/gi, "_")}-performance.csv`;

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    if (
      err instanceof Error &&
      (err.message === "Unauthorized" || err.message === "Advertiser not found")
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
