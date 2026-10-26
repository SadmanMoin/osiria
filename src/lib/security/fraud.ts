import type { CampaignPlatform } from "@/lib/campaigns/types";
import type {
  ProofSubmissionContext,
  SecurityEvaluationResult,
} from "@/lib/security/types";

// Platform authorized domain map
const PLATFORM_DOMAINS: Record<CampaignPlatform, string[]> = {
  X: ["x.com", "twitter.com", "mobile.twitter.com"],
  FACEBOOK: ["facebook.com", "www.facebook.com", "m.facebook.com", "fb.watch"],
  INSTAGRAM: ["instagram.com", "www.instagram.com"],
  TIKTOK: ["tiktok.com", "www.tiktok.com"],
  YOUTUBE: ["youtube.com", "www.youtube.com", "youtu.be"],
  THREADS: ["threads.net", "www.threads.net"],
  LINKEDIN: ["linkedin.com", "www.linkedin.com"],
};

const DISALLOWED_SHORTENERS = [
  "bit.ly",
  "tinyurl.com",
  "is.gd",
  "t.co",
  "ow.ly",
  "buff.ly",
  "goo.gl",
];

const STRIPPED_QUERY_PARAMS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "s",
  "t",
  "ref",
  "ref_src",
  "fbclid",
  "igshid",
  "feature",
];

/**
 * Normalizes a URL for canonical fraud comparison.
 * Strips tracking parameters, lowercases domain, removes trailing slash and hash.
 */
export function normalizeProofUrl(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl.trim());
    parsed.hash = "";

    // Remove tracking queries
    for (const param of STRIPPED_QUERY_PARAMS) {
      parsed.searchParams.delete(param);
    }

    // Lowercase host
    let host = parsed.hostname.toLowerCase().replace(/^www\./, "");
    if (["twitter.com", "mobile.twitter.com", "mobile.x.com"].includes(host)) host = "x.com";
    if (host === "m.facebook.com") host = "facebook.com";
    parsed.searchParams.sort();
    let pathname = parsed.pathname.replace(/\/+$/, "");
    if (!pathname) pathname = "/";

    // X status IDs identify a post independently of handle spelling or query parameters.
    const statusId = host === "x.com" ? pathname.match(/\/(?:status|statuses)\/(\d+)$/)?.[1] : null;
    if (statusId) return `https://x.com/i/status/${statusId}`;
    const search = parsed.searchParams.toString();
    return `https://${host}${pathname}${search ? `?${search}` : ""}`;
  } catch {
    return rawUrl.trim().toLowerCase();
  }
}

/**
 * Extract social handle from proof URL if available.
 * E.g. https://x.com/elonmusk/status/1234 -> elonmusk
 */
export function extractHandleFromUrl(
  platform: CampaignPlatform,
  proofUrl: string,
): string | null {
  try {
    const parsed = new URL(proofUrl);
    const parts = parsed.pathname.split("/").filter(Boolean);

    if (platform === "X" && parts.length >= 1) {
      const first = parts[0];
      // Reserved paths that are not handles
      if (!["home", "explore", "search", "messages", "settings", "i"].includes(first.toLowerCase())) {
        return first.toLowerCase().replace(/^@/, "");
      }
    }

    if (platform === "INSTAGRAM" && parts.length >= 1) {
      const first = parts[0];
      if (!["p", "reel", "stories", "tv", "explore"].includes(first.toLowerCase())) {
        return first.toLowerCase().replace(/^@/, "");
      }
    }

    if (platform === "FACEBOOK" && parts.length >= 1) {
      const first = parts[0];
      if (!["groups", "pages", "watch", "photo", "story"].includes(first.toLowerCase())) {
        return first.toLowerCase();
      }
    }

    return null;
  } catch {
    return null;
  }
}

export type ExistingSubmissionSummary = {
  id: string;
  userId: string;
  taskId: string;
  proofUrl: string;
  createdAt: string;
};

/**
 * Checks if the proof URL matches the expected domain for the platform.
 */
export function validatePlatformDomain(
  platform: CampaignPlatform,
  proofUrl: string,
): { valid: boolean; reason?: string } {
  try {
    const parsed = new URL(proofUrl);
    const host = parsed.hostname.toLowerCase();
    if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password || parsed.port) {
      return { valid: false, reason: "Provide a direct public web URL without credentials or custom ports." };
    }

    if (DISALLOWED_SHORTENERS.some((d) => host === d || host.endsWith(`.${d}`))) {
      return {
        valid: false,
        reason: `URL shorteners like ${host} are prohibited. Please provide the direct link on ${platform}.`,
      };
    }

    const allowed = PLATFORM_DOMAINS[platform] ?? [];
    const isAllowed = allowed.some((d) => host === d || host.endsWith(`.${d}`));

    if (!isAllowed) {
      return {
        valid: false,
        reason: `The submitted link domain (${host}) does not match the required platform (${platform}).`,
      };
    }

    return { valid: true };
  } catch {
    return { valid: false, reason: "Invalid URL format." };
  }
}

/**
 * Evaluates a submission against fraud heuristics:
 * 1. Duplicate proof URL (same user across tasks or different user stealing proof)
 * 2. Velocity abuse (rapid-fire automated submissions)
 * 3. Handle mismatch (proof link handle does not match worker's connected account)
 * 4. Suspicious or prohibited domains
 */
export function evaluateSubmissionSecurity(
  ctx: ProofSubmissionContext,
  history: {
    allRecentSubmissions: ExistingSubmissionSummary[];
    userRecentSubmissions: ExistingSubmissionSummary[];
    nowMs?: number;
  },
): SecurityEvaluationResult {
  const reasons: string[] = [];
  const now = history.nowMs ?? Date.now();
  const normalizedNew = normalizeProofUrl(ctx.proofUrl);

  // 1. Domain verification
  const domainCheck = validatePlatformDomain(ctx.taskPlatform, ctx.proofUrl);
  if (!domainCheck.valid) {
    reasons.push(domainCheck.reason ?? "Invalid platform domain.");
    return {
      flagged: true,
      severity: "HIGH",
      fraudType: "MANUAL_REVIEW",
      reasons,
      details: {
        reason: "Disallowed or mismatched domain",
        proofUrl: ctx.proofUrl,
        platform: ctx.taskPlatform,
      },
    };
  }

  // 2. Duplicate Proof URL Check
  for (const existing of history.allRecentSubmissions) {
    const normalizedExisting = normalizeProofUrl(existing.proofUrl);
    if (normalizedExisting === normalizedNew) {
      if (existing.userId !== ctx.userId) {
        // Cross-user duplicate proof URL: Proof theft attempt!
        reasons.push(
          "This exact proof URL was already submitted by another worker. Duplicate proof submission across accounts is prohibited.",
        );
        return {
          flagged: true,
          severity: "CRITICAL",
          fraudType: "DUPLICATE_SUBMISSION",
          reasons,
          details: {
            reason: "Cross-user duplicate proof theft",
            conflictingSubmissionId: existing.id,
            originalAuthorId: existing.userId,
            proofUrl: ctx.proofUrl,
          },
        };
      }

      if (existing.taskId !== ctx.taskId) {
        // Same user reusing the exact same proof across different tasks
        reasons.push(
          "You have already submitted this exact proof link for another task. Each task requires unique proof.",
        );
        return {
          flagged: true,
          severity: "HIGH",
          fraudType: "DUPLICATE_SUBMISSION",
          reasons,
          details: {
            reason: "Re-using proof URL across multiple tasks",
            conflictingSubmissionId: existing.id,
            proofUrl: ctx.proofUrl,
          },
        };
      }
    }
  }

  // 3. Velocity Abuse Check
  const oneMinuteAgo = now - 60 * 1000;
  const thirtySecondsAgo = now - 30 * 1000;

  let countInLast30s = 0;
  let countInLastMinute = 0;

  for (const sub of history.userRecentSubmissions) {
    const subTime = new Date(sub.createdAt).getTime();
    if (subTime >= thirtySecondsAgo) {
      countInLast30s++;
    }
    if (subTime >= oneMinuteAgo) {
      countInLastMinute++;
    }
  }

  if (countInLast30s >= 3 || countInLastMinute >= 6) {
    reasons.push(
      "High submission velocity detected. You are submitting tasks unusually quickly. Submissions have been flagged for automated bot review.",
    );
    return {
      flagged: true,
      severity: "HIGH",
      fraudType: "VELOCITY",
      reasons,
      details: {
        reason: "Excessive submission velocity",
        countInLast30s,
        countInLastMinute,
      },
    };
  }

  // 4. Handle mismatch check
  if (ctx.workerHandle) {
    const urlHandle = extractHandleFromUrl(ctx.taskPlatform, ctx.proofUrl);
    const cleanWorkerHandle = ctx.workerHandle.toLowerCase().replace(/^@/, "");

    if (urlHandle && urlHandle !== cleanWorkerHandle) {
      reasons.push(
        `The profile handle in the proof link (@${urlHandle}) does not match your verified social handle (@${cleanWorkerHandle}).`,
      );
      return {
        flagged: true,
        severity: "HIGH",
        fraudType: "ACCOUNT_MISMATCH",
        reasons,
        details: {
          reason: "Handle mismatch",
          urlHandle,
          workerHandle: cleanWorkerHandle,
        },
      };
    }
  }

  return {
    flagged: false,
    severity: "LOW",
    reasons: [],
  };
}
