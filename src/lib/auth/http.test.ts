import { describe, expect, it } from "vitest";
import { readCookie, rejectCrossOrigin, resolveAppOrigin } from "@/lib/auth/http";

describe("request helpers", () => {
  it("reads one cookie value", () => {
    const request = new Request("http://localhost/api/auth/session", {
      headers: { cookie: "other=1; osiria_session=abc%2Bdef" },
    });
    expect(readCookie(request, "osiria_session")).toBe("abc+def");
  });

  it("rejects a cross-origin mutation", async () => {
    const request = new Request("https://osiria.example/api/auth/login", {
      method: "POST",
      headers: { origin: "https://evil.example", host: "osiria.example" },
    });
    const response = rejectCrossOrigin(request);
    expect(response?.status).toBe(403);
  });

  it("ignores a hostile host when production has no APP_ORIGIN", () => {
    expect(
      resolveAppOrigin({
        appOrigin: undefined,
        nodeEnv: "production",
        host: "evil.example",
        proto: "https",
      }),
    ).toBe("http://localhost:3000");
  });
});
