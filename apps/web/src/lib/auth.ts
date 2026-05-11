import { auth, currentUser } from "@clerk/nextjs/server";
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

export async function requireOps() {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const user = await currentUser();
  if (!user) throw new Error("Unauthorized");

  const email = user.emailAddresses[0]?.emailAddress ?? "";
  const allowlist = (process.env.OPS_EMAIL_ALLOWLIST ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (!allowlist.includes(email)) throw new Error("Forbidden");

  return { userId, email };
}
