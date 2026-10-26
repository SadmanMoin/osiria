export const ELIGIBILITY_PLATFORMS = ["X", "FACEBOOK", "INSTAGRAM"] as const;

export type EligibilityPlatform = (typeof ELIGIBILITY_PLATFORMS)[number];

export type EligibilityJoin = "OR" | "AND";

export type AudienceMetric = "FOLLOWERS" | "FRIENDS";

export type EligibilityStatus =
  | "PENDING_VERIFICATION"
  | "ELIGIBLE"
  | "INELIGIBLE"
  | "MANUAL_REVIEW";

export type PlatformRule = {
  platform: EligibilityPlatform;
  displayName: string;
  isEnabled: boolean;
  accountCreatedOnOrBefore: string | null;
  minAudience: number | null;
  ruleJoin: EligibilityJoin;
  audienceMetric: AudienceMetric;
};

export const DEFAULT_RULE_IDS: Record<EligibilityPlatform, string> = {
  X: "11111111-1111-4111-8111-111111111111",
  FACEBOOK: "22222222-2222-4222-8222-222222222222",
  INSTAGRAM: "33333333-3333-4333-8333-333333333333",
};

export const DEFAULT_PLATFORM_RULES: readonly PlatformRule[] = [
  {
    platform: "X",
    displayName: "X",
    isEnabled: true,
    accountCreatedOnOrBefore: "2022-12-31",
    minAudience: 1000,
    ruleJoin: "OR",
    audienceMetric: "FOLLOWERS",
  },
  {
    platform: "FACEBOOK",
    displayName: "Facebook",
    isEnabled: true,
    accountCreatedOnOrBefore: null,
    minAudience: 50,
    ruleJoin: "AND",
    audienceMetric: "FRIENDS",
  },
  {
    platform: "INSTAGRAM",
    displayName: "Instagram",
    isEnabled: true,
    accountCreatedOnOrBefore: "2022-12-31",
    minAudience: 1000,
    ruleJoin: "OR",
    audienceMetric: "FOLLOWERS",
  },
];

const DISPLAY_NAMES: Record<EligibilityPlatform, string> = {
  X: "X",
  FACEBOOK: "Facebook",
  INSTAGRAM: "Instagram",
};

export function isEligibilityPlatform(value: string): value is EligibilityPlatform {
  return (ELIGIBILITY_PLATFORMS as readonly string[]).includes(value);
}

export function canonicalDisplayName(platform: EligibilityPlatform): string {
  return DISPLAY_NAMES[platform];
}

export function audienceUnit(metric: AudienceMetric): "followers" | "friends" {
  return metric === "FRIENDS" ? "friends" : "followers";
}

export function sortRules(rules: PlatformRule[]): PlatformRule[] {
  return [...rules].sort(
    (left, right) =>
      ELIGIBILITY_PLATFORMS.indexOf(left.platform) - ELIGIBILITY_PLATFORMS.indexOf(right.platform),
  );
}

export function describeRule(rule: PlatformRule): string {
  if (!rule.isEnabled) {
    return `${rule.displayName} is disabled.`;
  }
  const parts: string[] = [];
  if (rule.accountCreatedOnOrBefore) {
    parts.push(`account created on or before ${rule.accountCreatedOnOrBefore}`);
  }
  if (rule.minAudience !== null) {
    parts.push(`at least ${rule.minAudience} ${audienceUnit(rule.audienceMetric)}`);
  }
  if (parts.length === 0) {
    return `${rule.displayName} has no eligibility threshold saved.`;
  }
  const join = parts.length === 2 && rule.ruleJoin === "AND" ? " and " : " or ";
  const body = parts.length === 2 ? parts.join(join) : parts[0];
  return `${rule.displayName}: ${body}.`;
}

export function formatCreatedOn(value: string | null): string {
  return value ?? "Not provided";
}

export function formatAudienceCount(count: number | null, metric: AudienceMetric): string {
  if (count === null) {
    return "Not provided";
  }
  return `${count} ${audienceUnit(metric)}`;
}
