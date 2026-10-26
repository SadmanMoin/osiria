import { describe, expect, it } from "vitest";
import { maskEmail, resetDeliveryMode, resetUrl } from "@/lib/auth/mailer";

describe("password reset delivery", () => {
  it("does not log reset links in production when no webhook is set", () => {
    expect(resetDeliveryMode({ nodeEnv: "production" })).toBe("unconfigured");
    expect(resetDeliveryMode({ nodeEnv: "development" })).toBe("development-log");
    expect(resetDeliveryMode({ nodeEnv: "production", webhook: "https://mail.example" })).toBe(
      "webhook",
    );
  });

  it("builds a reset url without putting the token in the path", () => {
    const url = new URL(resetUrl("https://osiria.example", "token-value"));
    expect(url.pathname).toBe("/reset-password");
    expect(url.searchParams.get("token")).toBe("token-value");
    expect(maskEmail("ada@example.com")).toBe("a***@example.com");
  });
});
