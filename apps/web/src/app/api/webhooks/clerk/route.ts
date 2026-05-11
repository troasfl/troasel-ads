import { Webhook } from "svix";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

type ClerkUserEvent = {
  type: string;
  data: {
    id: string;
    email_addresses: { email_address: string }[];
    first_name: string | null;
    last_name: string | null;
  };
};

export async function POST(req: Request) {
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;
  if (!WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 });
  }

  const headerPayload = await headers();
  const svix_id = headerPayload.get("svix-id");
  const svix_timestamp = headerPayload.get("svix-timestamp");
  const svix_signature = headerPayload.get("svix-signature");

  if (!svix_id || !svix_timestamp || !svix_signature) {
    return NextResponse.json({ error: "Missing svix headers" }, { status: 400 });
  }

  const payload = await req.json();
  const body = JSON.stringify(payload);

  const wh = new Webhook(WEBHOOK_SECRET);
  let event: ClerkUserEvent;

  try {
    event = wh.verify(body, {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    }) as ClerkUserEvent;
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "user.created") {
    const email = event.data.email_addresses[0]?.email_address ?? "";
    const name = [event.data.first_name, event.data.last_name]
      .filter(Boolean)
      .join(" ") || email;

    await db.advertiser.create({
      data: {
        clerkId: event.data.id,
        email,
        name,
      },
    });
  }

  if (event.type === "user.updated") {
    const email = event.data.email_addresses[0]?.email_address ?? "";
    const name = [event.data.first_name, event.data.last_name]
      .filter(Boolean)
      .join(" ") || email;

    await db.advertiser.updateMany({
      where: { clerkId: event.data.id },
      data: { email, name },
    });
  }

  return NextResponse.json({ success: true });
}
