import { auth } from "@clerk/nextjs/server";
import { db } from "./db";

export async function requireAdvertiser() {
  const { userId } = await auth();
  if (!userId) {
    throw new Error("Unauthorized");
  }

  const advertiser = await db.advertiser.findUnique({
    where: { clerkId: userId },
  });

  if (!advertiser) {
    throw new Error("Advertiser not found");
  }

  return advertiser;
}
