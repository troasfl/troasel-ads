"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const BID_TYPES = ["CPC", "CPM", "CPA", "REVENUE_SHARE"] as const;
type BidType = (typeof BID_TYPES)[number];

export function NewCampaignForm() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bidType, setBidType] = useState<BidType>("CPC");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const formData = new FormData(e.currentTarget);

    const payload: Record<string, unknown> = {
      name: formData.get("name"),
      destinationUrl: formData.get("destinationUrl"),
      budgetTotal: Number(formData.get("budgetTotal")),
      bidType,
    };

    const bidAmount = formData.get("bidAmount");
    if (bidAmount) payload.bidAmount = Number(bidAmount);

    const commissionRate = formData.get("commissionRate");
    if (commissionRate) payload.commissionRate = Number(commissionRate) / 100;

    const startDate = formData.get("startDate") as string;
    if (startDate) payload.startDate = new Date(startDate).toISOString();

    const endDate = formData.get("endDate") as string;
    if (endDate) payload.endDate = new Date(endDate).toISOString();

    try {
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = await res.json();
        setError(
          typeof body.error === "string"
            ? body.error
            : "Validation error. Please check your inputs."
        );
        return;
      }

      const data = await res.json() as { campaign: { id: string } };
      router.push(`/dashboard/campaigns/${data.campaign.id}`);
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const showBidAmount = bidType === "CPC" || bidType === "CPM" || bidType === "CPA";
  const showCommissionRate = bidType === "REVENUE_SHARE" || bidType === "CPA";

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      <Field label="Campaign Name" required>
        <input
          name="name"
          type="text"
          required
          placeholder="e.g. Summer Sale 2026"
          className="input"
        />
      </Field>

      <Field label="Destination URL" required>
        <input
          name="destinationUrl"
          type="url"
          required
          placeholder="https://example.com/landing-page"
          className="input"
        />
      </Field>

      <Field label="Total Budget (USD)" required>
        <input
          name="budgetTotal"
          type="number"
          required
          min="1"
          step="0.01"
          placeholder="1000.00"
          className="input"
        />
      </Field>

      <Field label="Bid Type" required>
        <div className="flex gap-2 flex-wrap">
          {BID_TYPES.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setBidType(type)}
              className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors ${
                bidType === type
                  ? "border-blue-600 bg-blue-600 text-white"
                  : "border-gray-300 bg-white text-gray-700 hover:border-gray-400"
              }`}
            >
              {type.replace("_", " ")}
            </button>
          ))}
        </div>
        <p className="text-xs text-gray-500 mt-1">
          {bidType === "CPC" && "Pay per click. Bid amount = max cost per click."}
          {bidType === "CPM" && "Pay per 1,000 impressions. Bid amount = cost per 1k imps."}
          {bidType === "CPA" && "Pay per acquisition/conversion."}
          {bidType === "REVENUE_SHARE" && "Earn a percentage of conversion revenue."}
        </p>
      </Field>

      {showBidAmount && (
        <Field label="Bid Amount (USD)">
          <input
            name="bidAmount"
            type="number"
            min="0.0001"
            step="0.0001"
            placeholder={bidType === "CPM" ? "2.50" : "0.25"}
            className="input"
          />
        </Field>
      )}

      {showCommissionRate && (
        <Field label="Commission Rate (%)">
          <input
            name="commissionRate"
            type="number"
            min="0"
            max="100"
            step="0.1"
            placeholder="15"
            className="input"
          />
        </Field>
      )}

      <div className="grid grid-cols-2 gap-4">
        <Field label="Start Date">
          <input name="startDate" type="date" className="input" />
        </Field>
        <Field label="End Date">
          <input name="endDate" type="date" className="input" />
        </Field>
      </div>

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex-1 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {isSubmitting ? "Creating…" : "Create Campaign"}
        </button>
        <a
          href="/dashboard"
          className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          Cancel
        </a>
      </div>
    </form>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      {children}
    </div>
  );
}
