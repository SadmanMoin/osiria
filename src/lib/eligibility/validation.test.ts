import { describe, expect, it } from "vitest";
import { DEFAULT_PLATFORM_RULES } from "@/lib/eligibility/rules";
import {
  parseHandle,
  parsePlatformRule,
  parsePlatformRules,
  parseRulesOrPartial,
} from "@/lib/eligibility/validation";

describe("Eligibility validation — parsePlatformRule", () => {
  it("accepts valid rule input", () => {
    const valid = parsePlatformRule({
      platform: "X",
      isEnabled: true,
      accountCreatedOnOrBefore: "2022-12-31",
      minAudience: 1000,
      ruleJoin: "OR",
      audienceMetric: "FOLLOWERS",
    });
    expect(valid.ok).toBe(true);
    if (!valid.ok) return;
    expect(valid.rules[0]).toMatchObject({
      platform: "X",
      isEnabled: true,
      accountCreatedOnOrBefore: "2022-12-31",
      minAudience: 1000,
      ruleJoin: "OR",
      audienceMetric: "FOLLOWERS",
    });
  });

  it("rejects unknown platform", () => {
    const invalid = parsePlatformRule({
      platform: "TIKTOK",
      isEnabled: true,
      minAudience: 1000,
      ruleJoin: "OR",
      audienceMetric: "FOLLOWERS",
    });
    expect(invalid.ok).toBe(false);
  });

  it("requires an enabled platform to specify a date cutoff or minimum audience", () => {
    const invalid = parsePlatformRule({
      platform: "X",
      isEnabled: true,
      accountCreatedOnOrBefore: "",
      minAudience: "",
      ruleJoin: "OR",
      audienceMetric: "FOLLOWERS",
    });
    expect(invalid.ok).toBe(false);
    if (invalid.ok) return;
    expect(invalid.fieldErrors).toHaveProperty("minAudience");
  });

  it("allows a disabled platform without thresholds", () => {
    const disabled = parsePlatformRule({
      platform: "X",
      isEnabled: false,
      accountCreatedOnOrBefore: "",
      minAudience: "",
      ruleJoin: "OR",
      audienceMetric: "FOLLOWERS",
    });
    expect(disabled.ok).toBe(true);
  });

  it("rejects invalid date formats and years out of range", () => {
    const badDate = parsePlatformRule({
      platform: "X",
      isEnabled: true,
      accountCreatedOnOrBefore: "31-12-2022",
      minAudience: 100,
      ruleJoin: "OR",
      audienceMetric: "FOLLOWERS",
    });
    expect(badDate.ok).toBe(false);

    const oldYear = parsePlatformRule({
      platform: "X",
      isEnabled: true,
      accountCreatedOnOrBefore: "1960-01-01",
      minAudience: 100,
      ruleJoin: "OR",
      audienceMetric: "FOLLOWERS",
    });
    expect(oldYear.ok).toBe(false);
  });

  it("rejects invalid audience numbers", () => {
    const negative = parsePlatformRule({
      platform: "X",
      isEnabled: true,
      accountCreatedOnOrBefore: null,
      minAudience: -5,
      ruleJoin: "OR",
      audienceMetric: "FOLLOWERS",
    });
    expect(negative.ok).toBe(false);

    const huge = parsePlatformRule({
      platform: "X",
      isEnabled: true,
      accountCreatedOnOrBefore: null,
      minAudience: 2_000_000_000,
      ruleJoin: "OR",
      audienceMetric: "FOLLOWERS",
    });
    expect(huge.ok).toBe(false);
  });
});

describe("Eligibility validation — parsePlatformRules and parseRulesOrPartial", () => {
  it("parses the complete array of 3 platform rules", () => {
    const result = parsePlatformRules(DEFAULT_PLATFORM_RULES);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rules).toHaveLength(3);
  });

  it("rejects when one of the platforms is missing", () => {
    const partial = DEFAULT_PLATFORM_RULES.filter((r) => r.platform !== "FACEBOOK");
    const result = parsePlatformRules(partial);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.fieldErrors).toHaveProperty("FACEBOOK.platform");
  });

  it("rejects duplicate platform entries", () => {
    const dups = [DEFAULT_PLATFORM_RULES[0], DEFAULT_PLATFORM_RULES[0], DEFAULT_PLATFORM_RULES[1]];
    const result = parsePlatformRules(dups);
    expect(result.ok).toBe(false);
  });

  it("parseRulesOrPartial merges a single rule update cleanly into existing rules", () => {
    const defaults = [...DEFAULT_PLATFORM_RULES];
    const update = parseRulesOrPartial(
      {
        platform: "FACEBOOK",
        isEnabled: false,
        accountCreatedOnOrBefore: null,
        minAudience: 200,
        ruleJoin: "AND",
        audienceMetric: "FRIENDS",
      },
      defaults,
    );
    expect(update.ok).toBe(true);
    if (!update.ok) return;
    expect(update.rules).toHaveLength(3);
    const fb = update.rules.find((r) => r.platform === "FACEBOOK");
    expect(fb?.isEnabled).toBe(false);
    expect(fb?.minAudience).toBe(200);

    // Other platforms remain unchanged
    const x = update.rules.find((r) => r.platform === "X");
    expect(x?.minAudience).toBe(1000);
  });
});

describe("Eligibility validation — parseHandle", () => {
  it("normalizes and lowercases valid handles and strips @", () => {
    expect(parseHandle("@crypto_king")).toBe("crypto_king");
    expect(parseHandle("@@MyHandle.ETH")).toBe("myhandle.eth");
    expect(parseHandle("user123")).toBe("user123");
  });

  it("rejects invalid handles", () => {
    expect(parseHandle("a")).toBeNull(); // < 2 characters
    expect(parseHandle("has space")).toBeNull();
    expect(parseHandle("bad$char")).toBeNull();
    expect(parseHandle("")).toBeNull();
    expect(parseHandle(null)).toBeNull();
    expect(parseHandle("a".repeat(51))).toBeNull(); // > 50 characters
  });
});
