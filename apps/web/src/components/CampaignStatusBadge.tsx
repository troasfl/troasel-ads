import type { CampaignStatus } from "@prisma/client";

const styles: Record<CampaignStatus, string> = {
  ACTIVE: "bg-green-100 text-green-700",
  PAUSED: "bg-yellow-100 text-yellow-700",
  ENDED: "bg-gray-100 text-gray-600",
  ARCHIVED: "bg-red-100 text-red-600",
};

const labels: Record<CampaignStatus, string> = {
  ACTIVE: "Active",
  PAUSED: "Paused",
  ENDED: "Ended",
  ARCHIVED: "Archived",
};

export function CampaignStatusBadge({ status }: { status: CampaignStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${styles[status]}`}
    >
      {labels[status]}
    </span>
  );
}
