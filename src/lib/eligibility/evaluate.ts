import {
  audienceUnit,
  type EligibilityJoin,
  type EligibilityStatus,
  type PlatformRule,
} from "@/lib/eligibility/rules";

export type ProfileEvidence =
  | { availability: "none" }
  | { availability: "unavailable" }
  | {
      availability: "reported";
      accountCreatedOn: string | null;
      audienceCount: number | null;
    };

export type EligibilityVerdict = {
  status: EligibilityStatus;
  reasons: string[];
  accountCreatedOn: string | null;
  audienceCount: number | null;
};

type Clause = {
  kind: "pass" | "fail" | "unknown";
  reason: string;
};

const CALENDAR_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function calendarDate(value: string | null): string | null {
  if (!value || !CALENDAR_DATE.test(value)) {
    return null;
  }
  const match = CALENDAR_DATE.exec(value);
  if (!match) {
    return null;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return value;
}

export function wholeCount(value: number | null): number | null {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    return null;
  }
  return value;
}

function dateClause(rule: PlatformRule, createdOn: string | null): Clause {
  const cutoff = rule.accountCreatedOnOrBefore;
  if (!cutoff) {
    return {
      kind: "unknown",
      reason: `${rule.displayName} creation date was not provided, so the account-age rule could not be checked.`,
    };
  }
  if (!createdOn) {
    return {
      kind: "unknown",
      reason: `${rule.displayName} creation date was not provided, so the account-age rule could not be checked.`,
    };
  }
  if (createdOn <= cutoff) {
    return {
      kind: "pass",
      reason: `${rule.displayName} account was created on ${createdOn}, which is on or before ${cutoff}.`,
    };
  }
  return {
    kind: "fail",
    reason: `${rule.displayName} account was created on ${createdOn}, which is after ${cutoff}.`,
  };
}

function audienceClause(rule: PlatformRule, count: number | null, raw: number | null): Clause {
  const minimum = rule.minAudience;
  const unit = audienceUnit(rule.audienceMetric);
  if (minimum === null) {
    return {
      kind: "unknown",
      reason: `${rule.displayName} ${unit} count was not provided, so that rule could not be checked.`,
    };
  }
  if (count === null) {
    if (typeof raw === "number" && !Number.isInteger(raw)) {
      return {
        kind: "unknown",
        reason: `${rule.displayName} ${unit} count was not a whole number, so that rule could not be checked.`,
      };
    }
    return {
      kind: "unknown",
      reason: `${rule.displayName} ${unit} count was not provided, so that rule could not be checked.`,
    };
  }
  if (count >= minimum) {
    return {
      kind: "pass",
      reason: `${rule.displayName} has ${count} ${unit}, which meets the minimum of ${minimum}.`,
    };
  }
  return {
    kind: "fail",
    reason: `${rule.displayName} has ${count} ${unit}, which is below ${minimum}.`,
  };
}

function combine(join: EligibilityJoin, clauses: Clause[]): { status: EligibilityStatus; reasons: string[] } {
  const passes = clauses.filter((clause) => clause.kind === "pass");
  const fails = clauses.filter((clause) => clause.kind === "fail");
  const unknowns = clauses.filter((clause) => clause.kind === "unknown");

  if (join === "OR") {
    if (passes.length > 0) {
      return { status: "ELIGIBLE", reasons: passes.map((clause) => clause.reason) };
    }
    if (unknowns.length > 0) {
      return {
        status: "MANUAL_REVIEW",
        reasons: [...fails, ...unknowns].map((clause) => clause.reason),
      };
    }
    return { status: "INELIGIBLE", reasons: fails.map((clause) => clause.reason) };
  }

  if (fails.length > 0) {
    return { status: "INELIGIBLE", reasons: fails.map((clause) => clause.reason) };
  }
  if (unknowns.length > 0) {
    return { status: "MANUAL_REVIEW", reasons: unknowns.map((clause) => clause.reason) };
  }
  return { status: "ELIGIBLE", reasons: passes.map((clause) => clause.reason) };
}

export function evaluateEligibility(rule: PlatformRule, evidence: ProfileEvidence): EligibilityVerdict {
  const blank = { accountCreatedOn: null, audienceCount: null };
  if (!rule.isEnabled) {
    return { status: "INELIGIBLE", reasons: [`${rule.displayName} is disabled.`], ...blank };
  }
  if (evidence.availability === "none") {
    return {
      status: "PENDING_VERIFICATION",
      reasons: [
        `${rule.displayName} is waiting for verification. No profile data has been recorded.`,
      ],
      ...blank,
    };
  }
  if (evidence.availability === "unavailable") {
    return {
      status: "MANUAL_REVIEW",
      reasons: [
        `${rule.displayName} profile data is unavailable. Manual review is required.`,
        "No creation date or audience count was inferred.",
      ],
      ...blank,
    };
  }

  const accountCreatedOn = calendarDate(evidence.accountCreatedOn);
  const audienceCount = wholeCount(evidence.audienceCount);
  const clauses: Clause[] = [];
  if (rule.accountCreatedOnOrBefore) {
    clauses.push(dateClause(rule, accountCreatedOn));
  }
  if (rule.minAudience !== null) {
    clauses.push(audienceClause(rule, audienceCount, evidence.audienceCount));
  }
  if (clauses.length === 0) {
    return {
      status: "INELIGIBLE",
      reasons: [`${rule.displayName} has no eligibility threshold saved.`],
      accountCreatedOn,
      audienceCount,
    };
  }

  const outcome = combine(rule.ruleJoin, clauses);
  return {
    status: outcome.status,
    reasons: outcome.reasons,
    accountCreatedOn,
    audienceCount,
  };
}
