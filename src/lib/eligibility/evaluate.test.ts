import { describe, expect, it } from "vitest";
import {
  calendarDate,
  evaluateEligibility,
  wholeCount,
  type ProfileEvidence,
} from "@/lib/eligibility/evaluate";
import {
  DEFAULT_PLATFORM_RULES,
  type PlatformRule,
} from "@/lib/eligibility/rules";

describe("evaluateEligibility — Defaults", () => {
  const xRule = DEFAULT_PLATFORM_RULES.find((r) => r.platform === "X")!;
  const facebookRule = DEFAULT_PLATFORM_RULES.find((r) => r.platform === "FACEBOOK")!;
  const instagramRule = DEFAULT_PLATFORM_RULES.find((r) => r.platform === "INSTAGRAM")!;

  it("has the expected default thresholds for Phase 4", () => {
    expect(xRule).toMatchObject({
      platform: "X",
      isEnabled: true,
      accountCreatedOnOrBefore: "2022-12-31",
      minAudience: 1000,
      ruleJoin: "OR",
      audienceMetric: "FOLLOWERS",
    });

    expect(facebookRule).toMatchObject({
      platform: "FACEBOOK",
      isEnabled: true,
      accountCreatedOnOrBefore: null,
      minAudience: 50,
      audienceMetric: "FRIENDS",
    });

    expect(instagramRule).toMatchObject({
      platform: "INSTAGRAM",
      isEnabled: true,
      accountCreatedOnOrBefore: "2022-12-31",
      minAudience: 1000,
      ruleJoin: "OR",
      audienceMetric: "FOLLOWERS",
    });
  });
});

describe("evaluateEligibility — OR logic (X and Instagram defaults)", () => {
  const rule: PlatformRule = {
    platform: "X",
    displayName: "X",
    isEnabled: true,
    accountCreatedOnOrBefore: "2022-12-31",
    minAudience: 1000,
    ruleJoin: "OR",
    audienceMetric: "FOLLOWERS",
  };

  it("passes when account is old enough, even if audience is below threshold", () => {
    const evidence: ProfileEvidence = {
      availability: "reported",
      accountCreatedOn: "2021-06-15",
      audienceCount: 42,
    };
    const result = evaluateEligibility(rule, evidence);
    expect(result.status).toBe("ELIGIBLE");
    expect(result.reasons).toEqual([
      "X account was created on 2021-06-15, which is on or before 2022-12-31.",
    ]);
    expect(result.accountCreatedOn).toBe("2021-06-15");
    expect(result.audienceCount).toBe(42);
  });

  it("passes when audience meets threshold, even if account is newer than cutoff", () => {
    const evidence: ProfileEvidence = {
      availability: "reported",
      accountCreatedOn: "2024-03-01",
      audienceCount: 1500,
    };
    const result = evaluateEligibility(rule, evidence);
    expect(result.status).toBe("ELIGIBLE");
    expect(result.reasons).toEqual([
      "X has 1500 followers, which meets the minimum of 1000.",
    ]);
  });

  it("passes when both conditions are met", () => {
    const evidence: ProfileEvidence = {
      availability: "reported",
      accountCreatedOn: "2020-01-01",
      audienceCount: 5000,
    };
    const result = evaluateEligibility(rule, evidence);
    expect(result.status).toBe("ELIGIBLE");
    expect(result.reasons).toHaveLength(2);
  });

  it("evaluates boundary values accurately", () => {
    // Exact date boundary
    const onDateBoundary = evaluateEligibility(rule, {
      availability: "reported",
      accountCreatedOn: "2022-12-31",
      audienceCount: 0,
    });
    expect(onDateBoundary.status).toBe("ELIGIBLE");

    const afterDateBoundary = evaluateEligibility(rule, {
      availability: "reported",
      accountCreatedOn: "2023-01-01",
      audienceCount: 0,
    });
    expect(afterDateBoundary.status).toBe("INELIGIBLE");

    // Exact audience boundary
    const onAudienceBoundary = evaluateEligibility(rule, {
      availability: "reported",
      accountCreatedOn: "2025-01-01",
      audienceCount: 1000,
    });
    expect(onAudienceBoundary.status).toBe("ELIGIBLE");

    const belowAudienceBoundary = evaluateEligibility(rule, {
      availability: "reported",
      accountCreatedOn: "2025-01-01",
      audienceCount: 999,
    });
    expect(belowAudienceBoundary.status).toBe("INELIGIBLE");
  });

  it("returns clear failure reasons when both conditions fail", () => {
    const evidence: ProfileEvidence = {
      availability: "reported",
      accountCreatedOn: "2023-05-10",
      audienceCount: 120,
    };
    const result = evaluateEligibility(rule, evidence);
    expect(result.status).toBe("INELIGIBLE");
    expect(result.reasons).toEqual([
      "X account was created on 2023-05-10, which is after 2022-12-31.",
      "X has 120 followers, which is below 1000.",
    ]);
  });

  it("passes when date is met even if audience count is unknown", () => {
    const evidence: ProfileEvidence = {
      availability: "reported",
      accountCreatedOn: "2021-01-01",
      audienceCount: null,
    };
    const result = evaluateEligibility(rule, evidence);
    expect(result.status).toBe("ELIGIBLE");
  });

  it("requests manual review when date fails and audience count is unknown", () => {
    const evidence: ProfileEvidence = {
      availability: "reported",
      accountCreatedOn: "2024-01-01",
      audienceCount: null,
    };
    const result = evaluateEligibility(rule, evidence);
    expect(result.status).toBe("MANUAL_REVIEW");
    expect(result.reasons).toContain(
      "X account was created on 2024-01-01, which is after 2022-12-31.",
    );
    expect(result.reasons).toContain(
      "X followers count was not provided, so that rule could not be checked.",
    );
  });

  it("requests manual review when both data points are missing", () => {
    const evidence: ProfileEvidence = {
      availability: "reported",
      accountCreatedOn: null,
      audienceCount: null,
    };
    const result = evaluateEligibility(rule, evidence);
    expect(result.status).toBe("MANUAL_REVIEW");
  });
});

describe("evaluateEligibility — AND logic", () => {
  const facebookRule: PlatformRule = {
    platform: "FACEBOOK",
    displayName: "Facebook",
    isEnabled: true,
    accountCreatedOnOrBefore: null,
    minAudience: 50,
    ruleJoin: "AND",
    audienceMetric: "FRIENDS",
  };

  const multiAndRule: PlatformRule = {
    platform: "X",
    displayName: "X",
    isEnabled: true,
    accountCreatedOnOrBefore: "2022-12-31",
    minAudience: 1000,
    ruleJoin: "AND",
    audienceMetric: "FOLLOWERS",
  };

  it("evaluates single-threshold Facebook rule correctly", () => {
    const pass = evaluateEligibility(facebookRule, {
      availability: "reported",
      accountCreatedOn: null,
      audienceCount: 50,
    });
    expect(pass.status).toBe("ELIGIBLE");
    expect(pass.reasons).toEqual([
      "Facebook has 50 friends, which meets the minimum of 50.",
    ]);

    const fail = evaluateEligibility(facebookRule, {
      availability: "reported",
      accountCreatedOn: null,
      audienceCount: 49,
    });
    expect(fail.status).toBe("INELIGIBLE");
    expect(fail.reasons).toEqual([
      "Facebook has 49 friends, which is below 50.",
    ]);

    const unknown = evaluateEligibility(facebookRule, {
      availability: "reported",
      accountCreatedOn: null,
      audienceCount: null,
    });
    expect(unknown.status).toBe("MANUAL_REVIEW");
    expect(unknown.reasons).toEqual([
      "Facebook friends count was not provided, so that rule could not be checked.",
    ]);
  });

  it("evaluates multi-threshold AND rule: all clauses must pass", () => {
    const bothPass = evaluateEligibility(multiAndRule, {
      availability: "reported",
      accountCreatedOn: "2021-01-01",
      audienceCount: 1500,
    });
    expect(bothPass.status).toBe("ELIGIBLE");

    const dateFails = evaluateEligibility(multiAndRule, {
      availability: "reported",
      accountCreatedOn: "2024-01-01",
      audienceCount: 1500,
    });
    expect(dateFails.status).toBe("INELIGIBLE");
    expect(dateFails.reasons).toEqual([
      "X account was created on 2024-01-01, which is after 2022-12-31.",
    ]);

    const audienceFails = evaluateEligibility(multiAndRule, {
      availability: "reported",
      accountCreatedOn: "2021-01-01",
      audienceCount: 500,
    });
    expect(audienceFails.status).toBe("INELIGIBLE");
    expect(audienceFails.reasons).toEqual([
      "X has 500 followers, which is below 1000.",
    ]);

    const dateFailsAndAudienceUnknown = evaluateEligibility(multiAndRule, {
      availability: "reported",
      accountCreatedOn: "2024-01-01",
      audienceCount: null,
    });
    expect(dateFailsAndAudienceUnknown.status).toBe("INELIGIBLE");

    const datePassesAndAudienceUnknown = evaluateEligibility(multiAndRule, {
      availability: "reported",
      accountCreatedOn: "2021-01-01",
      audienceCount: null,
    });
    expect(datePassesAndAudienceUnknown.status).toBe("MANUAL_REVIEW");
  });
});

describe("evaluateEligibility — Platform states and evidence availability", () => {
  const rule: PlatformRule = {
    platform: "X",
    displayName: "X",
    isEnabled: false,
    accountCreatedOnOrBefore: "2022-12-31",
    minAudience: 1000,
    ruleJoin: "OR",
    audienceMetric: "FOLLOWERS",
  };

  it("returns INELIGIBLE when platform is disabled, regardless of evidence", () => {
    const result = evaluateEligibility(rule, {
      availability: "reported",
      accountCreatedOn: "2020-01-01",
      audienceCount: 50000,
    });
    expect(result.status).toBe("INELIGIBLE");
    expect(result.reasons).toEqual(["X is disabled."]);
    expect(result.accountCreatedOn).toBeNull();
    expect(result.audienceCount).toBeNull();
  });

  it("returns PENDING_VERIFICATION when evidence availability is none", () => {
    const enabledRule: PlatformRule = { ...rule, isEnabled: true };
    const result = evaluateEligibility(enabledRule, { availability: "none" });
    expect(result.status).toBe("PENDING_VERIFICATION");
    expect(result.reasons).toEqual([
      "X is waiting for verification. No profile data has been recorded.",
    ]);
    expect(result.accountCreatedOn).toBeNull();
    expect(result.audienceCount).toBeNull();
  });

  it("returns MANUAL_REVIEW without inventing data when evidence is unavailable", () => {
    const enabledRule: PlatformRule = { ...rule, isEnabled: true };
    const result = evaluateEligibility(enabledRule, { availability: "unavailable" });
    expect(result.status).toBe("MANUAL_REVIEW");
    expect(result.reasons).toEqual([
      "X profile data is unavailable. Manual review is required.",
      "No creation date or audience count was inferred.",
    ]);
    expect(result.accountCreatedOn).toBeNull();
    expect(result.audienceCount).toBeNull();
  });

  it("returns INELIGIBLE if an enabled platform has neither cutoff nor audience", () => {
    const emptyRule: PlatformRule = {
      platform: "X",
      displayName: "X",
      isEnabled: true,
      accountCreatedOnOrBefore: null,
      minAudience: null,
      ruleJoin: "OR",
      audienceMetric: "FOLLOWERS",
    };
    const result = evaluateEligibility(emptyRule, {
      availability: "reported",
      accountCreatedOn: "2021-01-01",
      audienceCount: 500,
    });
    expect(result.status).toBe("INELIGIBLE");
    expect(result.reasons).toEqual(["X has no eligibility threshold saved."]);
  });
});

describe("helpers: calendarDate and wholeCount", () => {
  it("validates real calendar dates and rejects invalid ones", () => {
    expect(calendarDate("2022-12-31")).toBe("2022-12-31");
    expect(calendarDate("2020-02-29")).toBe("2020-02-29"); // leap year
    expect(calendarDate("2021-02-29")).toBeNull(); // not a leap year
    expect(calendarDate("invalid-date")).toBeNull();
    expect(calendarDate("2022-13-01")).toBeNull(); // month > 12
    expect(calendarDate(null)).toBeNull();
  });

  it("validates whole positive integers and rejects negative/fractional numbers", () => {
    expect(wholeCount(0)).toBe(0);
    expect(wholeCount(1000)).toBe(1000);
    expect(wholeCount(-1)).toBeNull();
    expect(wholeCount(12.34)).toBeNull();
    expect(wholeCount(NaN)).toBeNull();
    expect(wholeCount(null)).toBeNull();
  });
});
