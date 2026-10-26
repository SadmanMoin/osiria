import { describe, expect, it } from "vitest";
import { AUTH_REQUIRED_MESSAGE, FORBIDDEN_MESSAGE } from "@/lib/auth/constants";
import type { StoredUser } from "@/lib/auth/repository";
import { hashSecretToken } from "@/lib/auth/tokens";
import {
  getEligibilityAuditLogs,
  getEligibilityReviews,
  getEligibilitySettings,
  postEligibilityReview,
  postWorkerEligibility,
  putEligibilitySettings,
  type EligibilityHttpDeps,
} from "@/lib/eligibility/http";
import { MemoryEligibilityStore } from "@/lib/eligibility/memory-store";
import {
  decideReview,
  savePlatformRules,
  submitEligibilityCheck,
  unconfiguredProfileSource,
} from "@/lib/eligibility/service";

function makeUser(role: StoredUser["role"], id = `user-${role.toLowerCase()}`): StoredUser {
  return {
    id,
    email: `${role.toLowerCase()}@example.com`,
    displayName: `${role} User`,
    role,
    status: "ACTIVE",
    passwordHash: "hash",
  };
}

describe("Eligibility authorization — Service layer", () => {
  const store = new MemoryEligibilityStore();
  const adminActor = { id: "admin-1", role: "ADMIN" as const };
  const workerActor = { id: "worker-1", role: "WORKER" as const };
  const advertiserActor = { id: "advertiser-1", role: "ADVERTISER" as const };

  describe("savePlatformRules", () => {
    it("allows ADMIN to update settings", async () => {
      const result = await savePlatformRules(
        adminActor,
        { platform: "X", isEnabled: true, minAudience: 500, ruleJoin: "OR", audienceMetric: "FOLLOWERS" },
        store,
      );
      expect(result.ok).toBe(true);
    });

    it("forbids WORKER from updating settings", async () => {
      const result = await savePlatformRules(
        workerActor,
        { platform: "X", isEnabled: true },
        store,
      );
      expect(result).toMatchObject({ ok: false, status: 403, message: FORBIDDEN_MESSAGE });
    });

    it("forbids ADVERTISER from updating settings", async () => {
      const result = await savePlatformRules(
        advertiserActor,
        { platform: "X", isEnabled: true },
        store,
      );
      expect(result).toMatchObject({ ok: false, status: 403, message: FORBIDDEN_MESSAGE });
    });

    it("rejects unauthenticated requests (null actor)", async () => {
      const result = await savePlatformRules(
        null,
        { platform: "X", isEnabled: true },
        store,
      );
      expect(result).toMatchObject({ ok: false, status: 401, message: AUTH_REQUIRED_MESSAGE });
    });
  });

  describe("decideReview", () => {
    it("forbids non-admin actors from approving or rejecting reviews", async () => {
      const workerResult = await decideReview(
        workerActor,
        { userId: "worker-2", platform: "X", decision: "approve", note: "Approved valid user" },
        store,
      );
      expect(workerResult).toMatchObject({ ok: false, status: 403, message: FORBIDDEN_MESSAGE });

      const advertiserResult = await decideReview(
        advertiserActor,
        { userId: "worker-2", platform: "X", decision: "approve", note: "Approved valid user" },
        store,
      );
      expect(advertiserResult).toMatchObject({ ok: false, status: 403, message: FORBIDDEN_MESSAGE });

      const anonResult = await decideReview(
        null,
        { userId: "worker-2", platform: "X", decision: "approve", note: "Approved valid user" },
        store,
      );
      expect(anonResult).toMatchObject({ ok: false, status: 401, message: AUTH_REQUIRED_MESSAGE });
    });
  });

  describe("submitEligibilityCheck", () => {
    it("allows WORKER to submit eligibility checks", async () => {
      const result = await submitEligibilityCheck(
        workerActor,
        { platform: "X", handle: "myhandle" },
        store,
        unconfiguredProfileSource,
      );
      expect(result.ok).toBe(true);
    });

    it("forbids ADMIN from submitting worker eligibility checks", async () => {
      const result = await submitEligibilityCheck(
        adminActor,
        { platform: "X", handle: "adminhandle" },
        store,
        unconfiguredProfileSource,
      );
      expect(result).toMatchObject({ ok: false, status: 403, message: FORBIDDEN_MESSAGE });
    });

    it("forbids ADVERTISER from submitting worker eligibility checks", async () => {
      const result = await submitEligibilityCheck(
        advertiserActor,
        { platform: "X", handle: "adverthandle" },
        store,
        unconfiguredProfileSource,
      );
      expect(result).toMatchObject({ ok: false, status: 403, message: FORBIDDEN_MESSAGE });
    });

    it("rejects unauthenticated submissions", async () => {
      const result = await submitEligibilityCheck(
        null,
        { platform: "X", handle: "anonhandle" },
        store,
        unconfiguredProfileSource,
      );
      expect(result).toMatchObject({ ok: false, status: 401, message: AUTH_REQUIRED_MESSAGE });
    });
  });
});

describe("Eligibility authorization — HTTP handlers", () => {
  const users: Record<string, StoredUser> = {
    "admin-token": makeUser("ADMIN"),
    "worker-token": makeUser("WORKER"),
    "advertiser-token": makeUser("ADVERTISER"),
  };

  const deps: EligibilityHttpDeps = {
    resolveUser: async (tokenHash) => {
      for (const [rawToken, u] of Object.entries(users)) {
        if (hashSecretToken(rawToken) === tokenHash) {
          return u;
        }
      }
      return null;
    },
    store: new MemoryEligibilityStore(),
    source: unconfiguredProfileSource,
  };

  function requestWithAuth(url: string, rawToken?: string, options: RequestInit = {}): Request {
    const headers = new Headers(options.headers);
    if (rawToken) {
      headers.set("cookie", `osiria_session=${rawToken}`);
    }
    return new Request(url, { ...options, headers });
  }

  it("enforces admin role on GET /api/admin/eligibility", async () => {
    const anon = await getEligibilitySettings(new Request("http://localhost/api/admin/eligibility"), deps);
    expect(anon.status).toBe(401);

    const worker = await getEligibilitySettings(requestWithAuth("http://localhost/api/admin/eligibility", "worker-token"), deps);
    expect(worker.status).toBe(403);

    const admin = await getEligibilitySettings(requestWithAuth("http://localhost/api/admin/eligibility", "admin-token"), deps);
    expect(admin.status).toBe(200);
  });

  it("enforces admin role and CSRF on PUT /api/admin/eligibility", async () => {
    const body = JSON.stringify({ platform: "FACEBOOK", minAudience: 100 });

    const anon = await putEligibilitySettings(
      new Request("http://localhost/api/admin/eligibility", { method: "PUT", body }),
      deps,
    );
    expect(anon.status).toBe(401);

    const worker = await putEligibilitySettings(
      requestWithAuth("http://localhost/api/admin/eligibility", "worker-token", { method: "PUT", body }),
      deps,
    );
    expect(worker.status).toBe(403);

    const hostile = await putEligibilitySettings(
      requestWithAuth("https://osiria.example/api/admin/eligibility", "admin-token", {
        method: "PUT",
        headers: { origin: "https://evil.example", host: "osiria.example" },
        body,
      }),
      deps,
    );
    expect(hostile.status).toBe(403);

    const admin = await putEligibilitySettings(
      requestWithAuth("http://localhost/api/admin/eligibility", "admin-token", { method: "PUT", body }),
      deps,
    );
    expect(admin.status).toBe(200);
  });

  it("enforces admin role on reviews and audit endpoints", async () => {
    // Reviews GET
    const reviewsAnon = await getEligibilityReviews(new Request("http://localhost/api/admin/eligibility/reviews"), deps);
    expect(reviewsAnon.status).toBe(401);

    const reviewsWorker = await getEligibilityReviews(requestWithAuth("http://localhost/api/admin/eligibility/reviews", "worker-token"), deps);
    expect(reviewsWorker.status).toBe(403);

    const reviewsAdmin = await getEligibilityReviews(requestWithAuth("http://localhost/api/admin/eligibility/reviews", "admin-token"), deps);
    expect(reviewsAdmin.status).toBe(200);

    // Reviews POST
    const reviewBody = JSON.stringify({ userId: "worker-1", platform: "X", decision: "approve", note: "Approved in testing" });
    const postAnon = await postEligibilityReview(new Request("http://localhost/api/admin/eligibility/reviews", { method: "POST", body: reviewBody }), deps);
    expect(postAnon.status).toBe(401);

    const postWorker = await postEligibilityReview(requestWithAuth("http://localhost/api/admin/eligibility/reviews", "worker-token", { method: "POST", body: reviewBody }), deps);
    expect(postWorker.status).toBe(403);

    // Audit logs GET
    const auditAnon = await getEligibilityAuditLogs(new Request("http://localhost/api/admin/eligibility/audit"), deps);
    expect(auditAnon.status).toBe(401);

    const auditWorker = await getEligibilityAuditLogs(requestWithAuth("http://localhost/api/admin/eligibility/audit", "worker-token"), deps);
    expect(auditWorker.status).toBe(403);

    const auditAdmin = await getEligibilityAuditLogs(requestWithAuth("http://localhost/api/admin/eligibility/audit", "admin-token"), deps);
    expect(auditAdmin.status).toBe(200);
  });

  it("enforces worker role on POST /api/worker/eligibility", async () => {
    const body = JSON.stringify({ platform: "X", handle: "sampleworker" });

    const anon = await postWorkerEligibility(
      new Request("http://localhost/api/worker/eligibility", { method: "POST", body }),
      deps,
    );
    expect(anon.status).toBe(401);

    const admin = await postWorkerEligibility(
      requestWithAuth("http://localhost/api/worker/eligibility", "admin-token", { method: "POST", body }),
      deps,
    );
    expect(admin.status).toBe(403);

    const advertiser = await postWorkerEligibility(
      requestWithAuth("http://localhost/api/worker/eligibility", "advertiser-token", { method: "POST", body }),
      deps,
    );
    expect(advertiser.status).toBe(403);

    const worker = await postWorkerEligibility(
      requestWithAuth("http://localhost/api/worker/eligibility", "worker-token", { method: "POST", body }),
      deps,
    );
    expect(worker.status).toBe(200);
  });
});
