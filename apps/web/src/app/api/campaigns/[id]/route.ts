import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdvertiser } from "@/lib/auth";
import { db } from "@/lib/db";
import { CampaignStatus } from "@prisma/client";

const updateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  destinationUrl: z.string().url().optional(),
  budgetTotal: z.number().positive().optional(),
  status: z.nativeEnum(CampaignStatus).optional(),
  startDate: z.string().datetime().nullable().optional(),
  endDate: z.string().datetime().nullable().optional(),
});

async function getCampaignForAdvertiser(id: string, advertiserId: string) {
  const campaign = await db.campaign.findUnique({ where: { id } });
  if (!campaign || campaign.advertiserId !== advertiserId) return null;
  return campaign;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const advertiser = await requireAdvertiser();
    const { id } = await params;

    const campaign = await db.campaign.findUnique({
      where: { id },
      include: {
        _count: { select: { trackingEvents: true } },
      },
    });

    if (!campaign || campaign.advertiserId !== advertiser.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ campaign });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const advertiser = await requireAdvertiser();
    const { id } = await params;

    const existing = await getCampaignForAdvertiser(id, advertiser.id);
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = await req.json();
    const data = updateSchema.parse(body);

    const updated = await db.campaign.update({
      where: { id },
      data: {
        ...(data.name != null && { name: data.name }),
        ...(data.destinationUrl != null && { destinationUrl: data.destinationUrl }),
        ...(data.budgetTotal != null && { budgetTotal: data.budgetTotal }),
        ...(data.status != null && { status: data.status }),
        ...(data.startDate !== undefined && {
          startDate: data.startDate != null ? new Date(data.startDate) : null,
        }),
        ...(data.endDate !== undefined && {
          endDate: data.endDate != null ? new Date(data.endDate) : null,
        }),
      },
    });

    return NextResponse.json({ campaign: updated });
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

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const advertiser = await requireAdvertiser();
    const { id } = await params;

    const existing = await getCampaignForAdvertiser(id, advertiser.id);
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await db.campaign.update({
      where: { id },
      data: { status: "ARCHIVED" },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
