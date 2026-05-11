import Link from "next/link";
import { requireAdvertiser } from "@/lib/auth";
import { db } from "@/lib/db";
import { CampaignStatusBadge } from "@/components/CampaignStatusBadge";
import type { CampaignStatus } from "@prisma/client";

export default async function DashboardPage() {
  const advertiser = await requireAdvertiser();

  const campaigns = await db.campaign.findMany({
    where: {
      advertiserId: advertiser.id,
      status: { not: "ARCHIVED" },
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      status: true,
      bidType: true,
      budgetTotal: true,
      budgetSpent: true,
      destinationUrl: true,
      createdAt: true,
      _count: {
        select: {
          trackingEvents: {
            where: { eventType: "CLICK", isDuplicate: false },
          },
        },
      },
    },
  });

  const totalSpend = campaigns.reduce(
    (sum, c) => sum + Number(c.budgetSpent),
    0
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Campaigns</h1>
          <p className="text-sm text-gray-500 mt-1">
            Welcome back, {advertiser.name}
          </p>
        </div>
        <Link
          href="/dashboard/campaigns/new"
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
        >
          + New Campaign
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-8">
        <StatCard label="Total Campaigns" value={String(campaigns.length)} />
        <StatCard
          label="Active"
          value={String(campaigns.filter((c) => c.status === "ACTIVE").length)}
        />
        <StatCard
          label="Total Spend"
          value={`$${totalSpend.toLocaleString("en-US", { minimumFractionDigits: 2 })}`}
        />
      </div>

      {campaigns.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-lg font-medium">No campaigns yet</p>
          <p className="text-sm mt-1">Create your first campaign to get started.</p>
          <Link
            href="/dashboard/campaigns/new"
            className="mt-4 inline-block rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Create Campaign
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">
                  Campaign
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">
                  Status
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">
                  Bid Type
                </th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">
                  Budget
                </th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">
                  Spend
                </th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">
                  Clicks
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {campaigns.map((campaign) => (
                <tr key={campaign.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link
                      href={`/dashboard/campaigns/${campaign.id}`}
                      className="font-medium text-gray-900 hover:text-blue-600"
                    >
                      {campaign.name}
                    </Link>
                    <p className="text-xs text-gray-400 truncate max-w-xs mt-0.5">
                      {campaign.destinationUrl}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <CampaignStatusBadge status={campaign.status as CampaignStatus} />
                  </td>
                  <td className="px-4 py-3 text-gray-600">{campaign.bidType}</td>
                  <td className="px-4 py-3 text-right text-gray-900">
                    ${Number(campaign.budgetTotal).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-900">
                    ${Number(campaign.budgetSpent).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-900">
                    {campaign._count.trackingEvents.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/dashboard/campaigns/${campaign.id}`}
                      className="text-blue-600 hover:underline text-xs font-medium"
                    >
                      View →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 px-6 py-5">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
    </div>
  );
}
