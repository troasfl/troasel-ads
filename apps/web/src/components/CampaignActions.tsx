"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { CampaignStatus } from "@prisma/client";

export function CampaignActions({
  campaignId,
  currentStatus,
}: {
  campaignId: string;
  currentStatus: CampaignStatus;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function updateStatus(status: CampaignStatus) {
    setError(null);
    const res = await fetch(`/api/campaigns/${campaignId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) {
      setError("Failed to update status. Please try again.");
      return;
    }
    startTransition(() => router.refresh());
  }

  if (currentStatus === "ENDED" || currentStatus === "ARCHIVED") {
    return null;
  }

  return (
    <div className="flex items-center gap-2">
      {error && <p className="text-xs text-red-600">{error}</p>}
      {currentStatus === "ACTIVE" && (
        <button
          onClick={() => updateStatus("PAUSED")}
          disabled={isPending}
          className="rounded-lg border border-yellow-300 bg-yellow-50 px-3 py-1.5 text-sm font-medium text-yellow-700 hover:bg-yellow-100 disabled:opacity-50"
        >
          Pause
        </button>
      )}
      {currentStatus === "PAUSED" && (
        <button
          onClick={() => updateStatus("ACTIVE")}
          disabled={isPending}
          className="rounded-lg border border-green-300 bg-green-50 px-3 py-1.5 text-sm font-medium text-green-700 hover:bg-green-100 disabled:opacity-50"
        >
          Resume
        </button>
      )}
      <button
        onClick={() => updateStatus("ENDED")}
        disabled={isPending}
        className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
      >
        End Campaign
      </button>
    </div>
  );
}
