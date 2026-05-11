import { describe, it, expect } from "vitest";
import Decimal from "decimal.js";
import { computeCommission } from "../commission.js";
import { BidType, EventType } from "@troasel/db";

describe("computeCommission", () => {
  it("CPC: charges bidAmount per click, nothing for impressions/conversions", () => {
    const campaign = { bidType: BidType.CPC, bidAmount: "0.50", commissionRate: null };

    expect(computeCommission(campaign, { eventType: EventType.CLICK, conversionRevenue: null }))
      ?.toEqual(new Decimal("0.50"));

    expect(computeCommission(campaign, { eventType: EventType.IMPRESSION, conversionRevenue: null }))
      .toBeNull();

    expect(computeCommission(campaign, { eventType: EventType.CONVERSION, conversionRevenue: "100" }))
      .toBeNull();
  });

  it("CPM: charges bidAmount/1000 per impression", () => {
    const campaign = { bidType: BidType.CPM, bidAmount: "5.00", commissionRate: null };

    const result = computeCommission(campaign, { eventType: EventType.IMPRESSION, conversionRevenue: null });
    expect(result?.toFixed(5)).toBe("0.00500");

    expect(computeCommission(campaign, { eventType: EventType.CLICK, conversionRevenue: null }))
      .toBeNull();
  });

  it("CPA: charges fixed bidAmount per conversion", () => {
    const campaign = { bidType: BidType.CPA, bidAmount: "25.00", commissionRate: null };

    expect(computeCommission(campaign, { eventType: EventType.CONVERSION, conversionRevenue: "500" }))
      ?.toEqual(new Decimal("25.00"));

    expect(computeCommission(campaign, { eventType: EventType.CLICK, conversionRevenue: null }))
      .toBeNull();
  });

  it("REVENUE_SHARE: charges commissionRate % of conversion revenue", () => {
    const campaign = { bidType: BidType.REVENUE_SHARE, bidAmount: null, commissionRate: "0.20" };

    const result = computeCommission(campaign, { eventType: EventType.CONVERSION, conversionRevenue: "100.00" });
    expect(result?.toFixed(2)).toBe("20.00");

    // No revenue → null
    expect(computeCommission(campaign, { eventType: EventType.CONVERSION, conversionRevenue: null }))
      .toBeNull();
  });

  it("REVENUE_SHARE: does not charge for clicks or impressions", () => {
    const campaign = { bidType: BidType.REVENUE_SHARE, bidAmount: null, commissionRate: "0.20" };

    expect(computeCommission(campaign, { eventType: EventType.CLICK, conversionRevenue: null }))
      .toBeNull();
    expect(computeCommission(campaign, { eventType: EventType.IMPRESSION, conversionRevenue: null }))
      .toBeNull();
  });

  it("CPC: throws if bidAmount is missing (misconfigured campaign)", () => {
    const campaign = { bidType: BidType.CPC, bidAmount: null, commissionRate: null };
    expect(() =>
      computeCommission(campaign, { eventType: EventType.CLICK, conversionRevenue: null })
    ).toThrow("CPC campaign missing bidAmount");
  });
});
