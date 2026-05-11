import { NewCampaignForm } from "@/components/NewCampaignForm";
import Link from "next/link";

export default function NewCampaignPage() {
  return (
    <div className="max-w-2xl">
      <div className="mb-6 flex items-center gap-2 text-sm text-gray-500">
        <Link href="/dashboard" className="hover:text-gray-700">
          Campaigns
        </Link>
        <span>/</span>
        <span className="text-gray-900 font-medium">New Campaign</span>
      </div>
      <h1 className="text-2xl font-bold text-gray-900 mb-8">
        Create Campaign
      </h1>
      <NewCampaignForm />
    </div>
  );
}
