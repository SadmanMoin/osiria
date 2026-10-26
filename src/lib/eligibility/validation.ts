import {
  canonicalDisplayName,
  ELIGIBILITY_PLATFORMS,
  isEligibilityPlatform,
  type AudienceMetric,
  type EligibilityJoin,
  type EligibilityPlatform,
  type PlatformRule,
} from "@/lib/eligibility/rules";
import { calendarDate } from "@/lib/eligibility/evaluate";

const MAX_AUDIENCE = 1_000_000_000;

export type RuleFieldErrors = Record<string, string>;

export type ParsedRules =
  | { ok: true; rules: PlatformRule[] }
  | { ok: false; message: string; fieldErrors: RuleFieldErrors };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function enabledValue(value: unknown): boolean | null {
  if (typeof value === "boolean") {
    return value;
  }
  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }
  if (Array.isArray(value)) {
    return value.some((item) => item === true || item === "true");
  }
  return null;
}

function audienceValue(value: unknown): number | null | "invalid" {
  if (value === null || value === "" || value === undefined) {
    return null;
  }
  if (typeof value === "number") {
    if (!Number.isInteger(value) || value < 0 || value > MAX_AUDIENCE) {
      return "invalid";
    }
    return value;
  }
  if (typeof value !== "string" || !/^\d+$/.test(value.trim())) {
    return "invalid";
  }
  const parsed = Number(value.trim());
  if (!Number.isSafeInteger(parsed) || parsed > MAX_AUDIENCE) {
    return "invalid";
  }
  return parsed;
}

function dateValue(value: unknown): string | null | "invalid" {
  if (value === null || value === "" || value === undefined) {
    return null;
  }
  if (typeof value !== "string") {
    return "invalid";
  }
  const trimmed = value.trim();
  const parsed = calendarDate(trimmed);
  if (!parsed) {
    return "invalid";
  }
  const year = Number(parsed.slice(0, 4));
  if (year < 1970 || year > 2100) {
    return "invalid";
  }
  return parsed;
}

function joinValue(value: unknown): EligibilityJoin | null {
  if (value === "OR" || value === "AND") {
    return value;
  }
  return null;
}

function metricValue(value: unknown): AudienceMetric | null {
  if (value === "FOLLOWERS" || value === "FRIENDS") {
    return value;
  }
  return null;
}

export function parsePlatformRule(input: unknown, keyPrefix = ""): ParsedRules {
  const key = (field: string) => (keyPrefix ? `${keyPrefix}.${field}` : field);
  if (!isRecord(input)) {
    return { ok: false, message: "Each platform rule must be an object.", fieldErrors: {} };
  }
  const fieldErrors: RuleFieldErrors = {};
  const platformRaw = input.platform;
  if (typeof platformRaw !== "string" || !isEligibilityPlatform(platformRaw)) {
    fieldErrors[key("platform")] = "Choose X, Facebook, or Instagram.";
    return { ok: false, message: "Choose X, Facebook, or Instagram.", fieldErrors };
  }
  const platform: EligibilityPlatform = platformRaw;
  const isEnabled = enabledValue(input.isEnabled);
  if (isEnabled === null) {
    fieldErrors[key("isEnabled")] = "Choose whether this platform is enabled.";
  }
  const created = dateValue(input.accountCreatedOnOrBefore);
  if (created === "invalid") {
    fieldErrors[key("accountCreatedOnOrBefore")] = "Use a calendar date as YYYY-MM-DD.";
  }
  const minAudience = audienceValue(input.minAudience);
  if (minAudience === "invalid") {
    fieldErrors[key("minAudience")] = "Enter a whole number from 0 to 1000000000.";
  }
  const ruleJoin = joinValue(input.ruleJoin);
  if (!ruleJoin) {
    fieldErrors[key("ruleJoin")] = "Choose OR or AND.";
  }
  const audienceMetric = metricValue(input.audienceMetric);
  if (!audienceMetric) {
    fieldErrors[key("audienceMetric")] = "Choose followers or friends.";
  }
  if (isEnabled && created !== "invalid" && minAudience !== "invalid" && !created && minAudience === null) {
    fieldErrors[key("minAudience")] = "An enabled platform needs a date cutoff or a minimum audience.";
  }
  if (
    isEnabled === null ||
    created === "invalid" ||
    minAudience === "invalid" ||
    !ruleJoin ||
    !audienceMetric ||
    Object.keys(fieldErrors).length > 0
  ) {
    return { ok: false, message: "Check the eligibility settings.", fieldErrors };
  }
  return {
    ok: true,
    rules: [
      {
        platform,
        displayName: canonicalDisplayName(platform),
        isEnabled,
        accountCreatedOnOrBefore: created,
        minAudience,
        ruleJoin,
        audienceMetric,
      },
    ],
  };
}

export function parsePlatformRules(input: unknown): ParsedRules {
  const record = isRecord(input) ? input : null;
  const list = Array.isArray(input) ? input : record && Array.isArray(record.rules) ? record.rules : null;
  if (!list) {
    return {
      ok: false,
      message: "Send the X, Facebook, and Instagram rules.",
      fieldErrors: {},
    };
  }
  const rules: PlatformRule[] = [];
  const fieldErrors: RuleFieldErrors = {};
  const seen = new Set<string>();
  for (const item of list) {
    const platform =
      isRecord(item) && typeof item.platform === "string" ? item.platform : "rule";
    if (seen.has(platform)) {
      fieldErrors[`${platform}.platform`] = "Each platform can be saved once.";
      continue;
    }
    seen.add(platform);
    const parsed = parsePlatformRule(item, platform);
    if (!parsed.ok) {
      Object.assign(fieldErrors, parsed.fieldErrors);
      continue;
    }
    rules.push(parsed.rules[0]);
  }
  for (const platform of ELIGIBILITY_PLATFORMS) {
    if (!seen.has(platform)) {
      fieldErrors[`${platform}.platform`] = "X, Facebook, and Instagram are all required.";
    }
  }
  if (Object.keys(fieldErrors).length > 0 || rules.length !== ELIGIBILITY_PLATFORMS.length) {
    return { ok: false, message: "Check the eligibility settings.", fieldErrors };
  }
  return { ok: true, rules };
}

export function parseRulesOrPartial(
  input: unknown,
  existingRules: PlatformRule[],
): ParsedRules {
  if (isRecord(input) && typeof input.platform === "string" && !("rules" in input)) {
    const existing = existingRules.find((r) => r.platform === input.platform);
    const mergedObj = existing
      ? {
          platform: existing.platform,
          isEnabled: existing.isEnabled,
          accountCreatedOnOrBefore: existing.accountCreatedOnOrBefore,
          minAudience: existing.minAudience,
          ruleJoin: existing.ruleJoin,
          audienceMetric: existing.audienceMetric,
          ...input,
        }
      : input;
    const single = parsePlatformRule(mergedObj, input.platform);
    if (!single.ok) {
      return single;
    }
    const nextRule = single.rules[0];
    const merged = existingRules.map((rule) =>
      rule.platform === nextRule.platform ? nextRule : rule,
    );
    return { ok: true, rules: merged };
  }

  const record = isRecord(input) ? input : null;
  const list = Array.isArray(input) ? input : record && Array.isArray(record.rules) ? record.rules : null;
  if (!list) {
    return {
      ok: false,
      message: "Send the X, Facebook, and Instagram rules.",
      fieldErrors: {},
    };
  }

  const fieldErrors: RuleFieldErrors = {};
  const updatedRules = new Map<EligibilityPlatform, PlatformRule>();
  const seen = new Set<string>();

  for (const item of list) {
    const platform =
      isRecord(item) && typeof item.platform === "string" ? item.platform : "rule";
    if (seen.has(platform)) {
      fieldErrors[`${platform}.platform`] = "Each platform can be saved once.";
      continue;
    }
    seen.add(platform);
    const existing = existingRules.find((r) => r.platform === platform);
    const mergedItem = existing && isRecord(item)
      ? {
          platform: existing.platform,
          isEnabled: existing.isEnabled,
          accountCreatedOnOrBefore: existing.accountCreatedOnOrBefore,
          minAudience: existing.minAudience,
          ruleJoin: existing.ruleJoin,
          audienceMetric: existing.audienceMetric,
          ...item,
        }
      : item;
    const parsed = parsePlatformRule(mergedItem, platform);
    if (!parsed.ok) {
      Object.assign(fieldErrors, parsed.fieldErrors);
      continue;
    }
    updatedRules.set(parsed.rules[0].platform, parsed.rules[0]);
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, message: "Check the eligibility settings.", fieldErrors };
  }

  const merged = existingRules.map((existing) => updatedRules.get(existing.platform) ?? existing);
  return { ok: true, rules: merged };
}

export type EligibilityFormState = {
  error?: string;
  message?: string;
  fieldErrors?: Record<string, string>;
};

export function parseHandle(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const handle = value.trim().replace(/^@+/, "");
  if (!/^[A-Za-z0-9._]{2,50}$/.test(handle)) {
    return null;
  }
  return handle.toLowerCase();
}
