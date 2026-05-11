-- CreateEnum
CREATE TYPE "BidType" AS ENUM ('CPC', 'CPM', 'CPA', 'REVENUE_SHARE');

-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('ACTIVE', 'PAUSED', 'ENDED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('IMPRESSION', 'CLICK', 'CONVERSION');

-- CreateEnum
CREATE TYPE "EventSource" AS ENUM ('REDIRECT', 'PIXEL', 'S2S');

-- CreateEnum
CREATE TYPE "EntryType" AS ENUM ('EARN', 'REVERSAL');

-- CreateEnum
CREATE TYPE "PayoutStatus" AS ENUM ('PENDING', 'INVOICED', 'PAID', 'VOID');

-- CreateTable
CREATE TABLE "Advertiser" (
    "id" TEXT NOT NULL,
    "clerkId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Advertiser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL,
    "advertiserId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "CampaignStatus" NOT NULL DEFAULT 'ACTIVE',
    "bidType" "BidType" NOT NULL,
    "bidAmount" DECIMAL(65,30),
    "commissionRate" DECIMAL(65,30),
    "destinationUrl" TEXT NOT NULL,
    "budgetTotal" DECIMAL(65,30) NOT NULL,
    "budgetSpent" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrackingEvent" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "clickId" TEXT,
    "eventType" "EventType" NOT NULL,
    "source" "EventSource" NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip" TEXT,
    "userAgent" TEXT,
    "referer" TEXT,
    "conversionRevenue" DECIMAL(65,30),
    "conversionCurrency" TEXT DEFAULT 'USD',
    "isDuplicate" BOOLEAN NOT NULL DEFAULT false,
    "dedupeKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrackingEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommissionEntry" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "trackingEventId" TEXT NOT NULL,
    "entryType" "EntryType" NOT NULL DEFAULT 'EARN',
    "amount" DECIMAL(65,30) NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reversalForId" TEXT,

    CONSTRAINT "CommissionEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payout" (
    "id" TEXT NOT NULL,
    "advertiserId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "totalCommission" DECIMAL(65,30) NOT NULL,
    "status" "PayoutStatus" NOT NULL DEFAULT 'PENDING',
    "stripeInvoiceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payout_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Advertiser_clerkId_key" ON "Advertiser"("clerkId");

-- CreateIndex
CREATE UNIQUE INDEX "Advertiser_email_key" ON "Advertiser"("email");

-- CreateIndex
CREATE INDEX "Campaign_status_startDate_endDate_idx" ON "Campaign"("status", "startDate", "endDate");

-- CreateIndex
CREATE INDEX "TrackingEvent_campaignId_eventType_occurredAt_idx" ON "TrackingEvent"("campaignId", "eventType", "occurredAt");

-- CreateIndex
CREATE INDEX "TrackingEvent_clickId_idx" ON "TrackingEvent"("clickId");

-- CreateIndex
CREATE INDEX "TrackingEvent_occurredAt_idx" ON "TrackingEvent"("occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "CommissionEntry_trackingEventId_key" ON "CommissionEntry"("trackingEventId");

-- CreateIndex
CREATE INDEX "CommissionEntry_campaignId_computedAt_idx" ON "CommissionEntry"("campaignId", "computedAt");

-- CreateIndex
CREATE INDEX "CommissionEntry_computedAt_idx" ON "CommissionEntry"("computedAt");

-- CreateIndex
CREATE INDEX "Payout_advertiserId_periodStart_idx" ON "Payout"("advertiserId", "periodStart");

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_advertiserId_fkey" FOREIGN KEY ("advertiserId") REFERENCES "Advertiser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackingEvent" ADD CONSTRAINT "TrackingEvent_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionEntry" ADD CONSTRAINT "CommissionEntry_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionEntry" ADD CONSTRAINT "CommissionEntry_trackingEventId_fkey" FOREIGN KEY ("trackingEventId") REFERENCES "TrackingEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_advertiserId_fkey" FOREIGN KEY ("advertiserId") REFERENCES "Advertiser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
