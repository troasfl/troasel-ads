import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdvertiser } from "@/lib/auth";
import { db } from "@/lib/db";
import { CampaignStatusBadge } from "@/components/CampaignStatusBadge";
import { CampaignActions } from "@/components/CampaignActions";
import type { CampaignStatus } from "@prisma/client";

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const advertiser = await requireAdvertiser();
  const { id } = await params;

  const campaign = await db.campaign.findUnique({ where: { id } });
  if (!campaign || campaign.advertiserId !== advertiser.id) {
    notFound();
  }

  const [impressions, clicks, conversions] = await Promise.all([
    db.trackingEvent.count({
      where: { campaignId: id, eventType: "IMPRESSION", isDuplicate: false },
    }),
    db.trackingEvent.count({
      where: { campaignId: id, eventType: "CLICK", isDuplicate: false },
    }),
    db.trackingEvent.count({
      where: { campaignId: id, eventType: "CONVERSION", isDuplicate: false },
    }),
  ]);

  const commission = await db.commissionEntry.aggregate({
    where: { campaignId: id },
    _sum: { amount: true },
  });

  const spend = Number(campaign.budgetSpent);
  const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;

  return (
    <div>
      <div className="mb-6 flex items-center gap-2 text-sm text-gray-500">
        <Link href="/dashboard" className="hover:text-gray-700">
          Campaigns
        </Link>
        <span>/</span>
        <span className="text-gray-900 font-medium">{campaign.name}</span>
      </div>

      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">{campaign.name}</h1>
            <CampaignStatusBadge status={campaign.status as CampaignStatus} />
          </div>
          <a
            href={campaign.destinationUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-blue-600 hover:underline mt-1 block"
          >
            {campaign.destinationUrl}
          </a>
        </div>
        <CampaignActions campaignId={campaign.id} currentStatus={campaign.status as CampaignStatus} />
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5 mb-8">
        <PerfCard label="Impressions" value={impressions.toLocaleString()} />
        <PerfCard label="Clicks" value={clicks.toLocaleString()} />
        <PerfCard label="CTR" value={`${ctr.toFixed(2)}%`} />
        <PerfCard label="Conversions" value={conversions.toLocaleString()} />
        <PerfCard
          label="Spend"
          value={`$${spend.toLocaleString("en-US", { minimumFractionDigits: 2 })}`}
        />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-4">
          Campaign Details
        </h2>
        <dl className="grid grid-cols-2 gap-4 text-sm">
          <Detail label="Bid Type" value={campaign.bidType} />
          {campaign.bidAmount !== null && (
            <Detail
              label="Bid Amount"
              value={`$${Number(campaign.bidAmount).toFixed(4)}`}
            />
          )}
          {campaign.commissionRate !== null && (
            <Detail
              label="Commission Rate"
              value={`${(Number(campaign.commissionRate) * 100).toFixed(1)}%`}
            />
          )}
          <Detail
            label="Total Budget"
            value={`$${Number(campaign.budgetTotal).toLocaleString()}`}
          />
          <Detail
            label="Budget Remaining"
            value={`$${(Number(campaign.budgetTotal) - spend).toLocaleString("en-US", { minimumFractionDigits: 2 })}`}
          />
          <Detail
            label="Commission Earned"
            value={`$${Number(commission._sum.amount ?? 0).toFixed(2)}`}
          />
          {campaign.startDate && (
            <Detail
              label="Start Date"
              value={new Date(campaign.startDate).toLocaleDateString()}
            />
          )}
          {campaign.endDate && (
            <Detail
              label="End Date"
              value={new Date(campaign.endDate).toLocaleDateString()}
            />
          )}
          <Detail
            label="Created"
            value={new Date(campaign.createdAt).toLocaleDateString()}
          />
        </dl>
      </div>
    </div>
  );
}

function PerfCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 px-5 py-4">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
        {label}
      </p>
      <p className="text-xl font-bold text-gray-900 mt-1">{value}</p>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-gray-500">{label}</dt>
      <dd className="font-medium text-gray-900 mt-0.5">{value}</dd>
    </div>
  );
}
