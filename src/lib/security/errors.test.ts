import { describe, expect, it } from "vitest";
import { sanitizeText, sanitizeUrl, formatSafeError } from "@/lib/security/errors";
import { CampaignError } from "@/lib/campaigns/store";

describe("Security Input Sanitization & Error Handling", () => {
  describe("sanitizeText", () => {
    it("strips null bytes and non-printable control characters", () => {
      const dirty = "Hello\u0000World\u0007!\u001F";
      expect(sanitizeText(dirty)).toBe("HelloWorld!");
    });

    it("preserves legitimate newlines and tabs", () => {
      const text = "Line 1\nLine 2\tTabbed";
      expect(sanitizeText(text)).toBe("Line 1\nLine 2\tTabbed");
    });

    it("trims whitespace", () => {
      expect(sanitizeText("  spaced  ")).toBe("spaced");
    });

    it("enforces max length", () => {
      const long = "a".repeat(2000);
      expect(sanitizeText(long, 100)).toHaveLength(100);
    });

    it("returns empty string for non-string input", () => {
      expect(sanitizeText(42)).toBe("");
      expect(sanitizeText(null)).toBe("");
      expect(sanitizeText(undefined)).toBe("");
    });
  });

  describe("sanitizeUrl", () => {
    it("accepts valid https URLs", () => {
      expect(sanitizeUrl("https://x.com/user/status/123")).toBe(
        "https://x.com/user/status/123",
      );
    });

    it("accepts valid http URLs", () => {
      expect(sanitizeUrl("http://localhost:3000/api")).toBe("http://localhost:3000/api");
    });

    it("rejects javascript: protocol URLs", () => {
      expect(sanitizeUrl("javascript:alert(1)")).toBeNull();
    });

    it("rejects data: URLs", () => {
      expect(sanitizeUrl("data:text/html,<script>alert(1)</script>")).toBeNull();
    });

    it("rejects non-string input", () => {
      expect(sanitizeUrl(42)).toBeNull();
      expect(sanitizeUrl(null)).toBeNull();
    });

    it("rejects completely invalid URLs", () => {
      expect(sanitizeUrl("not-a-url-at-all")).toBeNull();
    });
  });

  describe("formatSafeError", () => {
    it("formats CampaignError without leaking internals", () => {
      const err = new CampaignError("Budget exceeded", 400);
      const result = formatSafeError(err);
      expect(result.ok).toBe(false);
      expect(result.status).toBe(400);
      expect(result.message).toBe("Budget exceeded");
      expect(result.correlationId).toBeUndefined();
    });

    it("formats unknown errors with generic message and correlation ID", () => {
      const result = formatSafeError(new Error("SQL injection attempt"));
      expect(result.ok).toBe(false);
      expect(result.status).toBe(500);
      expect(result.message).toBe("An internal server error occurred. Please try again later.");
      expect(result.correlationId).toBeDefined();
      expect(result.correlationId).toMatch(/^err_/);
      // Internal message must NOT be leaked
      expect(result.message).not.toContain("SQL");
    });

    it("uses fallback status for unknown errors", () => {
      const result = formatSafeError("string error", 503);
      expect(result.status).toBe(503);
    });
  });
});
