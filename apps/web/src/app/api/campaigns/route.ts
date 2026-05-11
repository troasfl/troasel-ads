import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdvertiser } from "@/lib/auth";
import { db } from "@/lib/db";
import { BidType } from "@prisma/client";

const createSchema = z.object({
  name: z.string().min(1).max(200),
  destinationUrl: z.string().url(),
  budgetTotal: z.number().positive(),
  bidType: z.nativeEnum(BidType),
  bidAmount: z.number().positive().optional(),
  commissionRate: z.number().min(0).max(1).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

export async function GET() {
  try {
    const advertiser = await requireAdvertiser();

    const campaigns = await db.campaign.findMany({
      where: { advertiserId: advertiser.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        status: true,
        bidType: true,
        bidAmount: true,
        destinationUrl: true,
        budgetTotal: true,
        budgetSpent: true,
        startDate: true,
        endDate: true,
        createdAt: true,
        _count: {
          select: { trackingEvents: true },
        },
      },
    });

    return NextResponse.json({ campaigns });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const advertiser = await requireAdvertiser();
    const body = await req.json();
    const data = createSchema.parse(body);

    const campaign = await db.campaign.create({
      data: {
        advertiserId: advertiser.id,
        name: data.name,
        destinationUrl: data.destinationUrl,
        budgetTotal: data.budgetTotal,
        bidType: data.bidType,
        ...(data.bidAmount != null && { bidAmount: data.bidAmount }),
        ...(data.commissionRate != null && { commissionRate: data.commissionRate }),
        ...(data.startDate != null && { startDate: new Date(data.startDate) }),
        ...(data.endDate != null && { endDate: new Date(data.endDate) }),
      },
    });

    return NextResponse.json({ campaign }, { status: 201 });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.flatten() }, { status: 422 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
