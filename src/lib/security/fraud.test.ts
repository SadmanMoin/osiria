import { describe, expect, it } from "vitest";
import {
  evaluateSubmissionSecurity,
  extractHandleFromUrl,
  normalizeProofUrl,
  validatePlatformDomain,
} from "@/lib/security/fraud";

describe("Fraud Detection & Security Heuristics", () => {
  describe("normalizeProofUrl", () => {
    it("strips tracking query params and trailing slashes", () => {
      const raw = "https://x.com/alice/status/12345?utm_source=share&s=20&ref=homepage";
      const normalized = normalizeProofUrl(raw);
      expect(normalized).toBe("https://x.com/i/status/12345");
    });

    it("lowercases hostnames and removes www", () => {
      expect(normalizeProofUrl("https://WWW.Facebook.COM/post/123/")).toBe(
        "https://facebook.com/post/123",
      );
    });

    it("preserves non-tracking query params", () => {
      const url = "https://youtube.com/watch?v=abc123";
      expect(normalizeProofUrl(url)).toBe("https://youtube.com/watch?v=abc123");
    });
  });

  describe("extractHandleFromUrl", () => {
    it("extracts X handles from tweet URLs", () => {
      expect(extractHandleFromUrl("X", "https://x.com/alice_dev/status/12345")).toBe("alice_dev");
    });

    it("skips reserved X paths like explore", () => {
      expect(extractHandleFromUrl("X", "https://x.com/explore")).toBeNull();
    });

    it("extracts Instagram handles from profile URLs", () => {
      expect(extractHandleFromUrl("INSTAGRAM", "https://instagram.com/@bob_photo")).toBe(
        "bob_photo",
      );
    });

    it("skips Instagram post paths", () => {
      expect(extractHandleFromUrl("INSTAGRAM", "https://instagram.com/p/BxQ123")).toBeNull();
    });

    it("returns null for unparseable URLs", () => {
      expect(extractHandleFromUrl("X", "not-a-url")).toBeNull();
    });
  });

  describe("validatePlatformDomain", () => {
    it("allows valid X domains", () => {
      expect(validatePlatformDomain("X", "https://x.com/user/status/1")).toEqual({ valid: true });
      expect(validatePlatformDomain("X", "https://twitter.com/user/status/1")).toEqual({
        valid: true,
      });
    });

    it("rejects mismatched platform domain", () => {
      const result = validatePlatformDomain("X", "https://instagram.com/user");
      expect(result.valid).toBe(false);
      expect(result.reason).toContain("does not match");
    });

    it("rejects URL shorteners", () => {
      const result = validatePlatformDomain("X", "https://bit.ly/abc123");
      expect(result.valid).toBe(false);
      expect(result.reason).toContain("shortener");
    });

    it("rejects invalid URLs", () => {
      const result = validatePlatformDomain("X", "trust-me-bro");
      expect(result.valid).toBe(false);
    });
  });

  describe("evaluateSubmissionSecurity", () => {
    const baseCtx = {
      taskId: "task-1",
      taskPlatform: "X" as const,
      userId: "worker-1",
      proofUrl: "https://x.com/alice_x/status/99999",
      workerHandle: "alice_x",
    };

    it("returns not flagged for a clean first submission", () => {
      const result = evaluateSubmissionSecurity(baseCtx, {
        allRecentSubmissions: [],
        userRecentSubmissions: [],
      });
      expect(result.flagged).toBe(false);
      expect(result.reasons).toHaveLength(0);
    });

    it("flags cross-user duplicate proof URL (proof theft)", () => {
      const result = evaluateSubmissionSecurity(baseCtx, {
        allRecentSubmissions: [
          {
            id: "sub-existing",
            userId: "worker-OTHER",
            taskId: "task-1",
            proofUrl: "https://x.com/alice_x/status/99999",
            createdAt: new Date().toISOString(),
          },
        ],
        userRecentSubmissions: [],
      });

      expect(result.flagged).toBe(true);
      expect(result.severity).toBe("CRITICAL");
      expect(result.fraudType).toBe("DUPLICATE_SUBMISSION");
      expect(result.reasons[0]).toContain("another worker");
    });

    it("flags same-user re-use of proof across different tasks", () => {
      const result = evaluateSubmissionSecurity(baseCtx, {
        allRecentSubmissions: [
          {
            id: "sub-existing",
            userId: "worker-1",
            taskId: "task-DIFFERENT",
            proofUrl: "https://x.com/alice_x/status/99999",
            createdAt: new Date().toISOString(),
          },
        ],
        userRecentSubmissions: [],
      });

      expect(result.flagged).toBe(true);
      expect(result.severity).toBe("HIGH");
      expect(result.fraudType).toBe("DUPLICATE_SUBMISSION");
      expect(result.reasons[0]).toContain("already submitted this exact proof");
    });

    it("flags velocity abuse (3+ submissions in 30 seconds)", () => {
      const now = Date.now();
      const recent = Array.from({ length: 3 }, (_, i) => ({
        id: `sub-${i}`,
        userId: "worker-1",
        taskId: `task-${i}`,
        proofUrl: `https://x.com/alice_x/status/${1000 + i}`,
        createdAt: new Date(now - 10_000 + i * 100).toISOString(), // all within last 10s
      }));

      const result = evaluateSubmissionSecurity(baseCtx, {
        allRecentSubmissions: recent,
        userRecentSubmissions: recent,
        nowMs: now,
      });

      expect(result.flagged).toBe(true);
      expect(result.fraudType).toBe("VELOCITY");
      expect(result.reasons[0]).toContain("velocity");
    });

    it("flags handle mismatch between proof URL and linked account", () => {
      const ctx = {
        ...baseCtx,
        proofUrl: "https://x.com/impersonator/status/99999",
        workerHandle: "alice_x",
      };

      const result = evaluateSubmissionSecurity(ctx, {
        allRecentSubmissions: [],
        userRecentSubmissions: [],
      });

      expect(result.flagged).toBe(true);
      expect(result.fraudType).toBe("ACCOUNT_MISMATCH");
      expect(result.reasons[0]).toContain("does not match");
    });

    it("flags wrong platform domain", () => {
      const ctx = {
        ...baseCtx,
        taskPlatform: "X" as const,
        proofUrl: "https://instagram.com/alice/post/123",
      };

      const result = evaluateSubmissionSecurity(ctx, {
        allRecentSubmissions: [],
        userRecentSubmissions: [],
      });

      expect(result.flagged).toBe(true);
      expect(result.severity).toBe("HIGH");
      expect(result.reasons[0]).toContain("does not match");
    });

    it("does not flag when handle matches", () => {
      const result = evaluateSubmissionSecurity(baseCtx, {
        allRecentSubmissions: [],
        userRecentSubmissions: [],
      });
      expect(result.flagged).toBe(false);
    });
  });
});
