import { CampaignError } from "@/lib/campaigns/store";

export type SafeErrorResult = {
  ok: false;
  status: number;
  message: string;
  correlationId?: string;
  fieldErrors?: Record<string, string>;
};

/**
 * Strips dangerous control characters and trims text.
 */
export function sanitizeText(input: unknown, maxLength = 1000): string {
  if (typeof input !== "string") return "";
  return input
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "") // Strip non-printable ASCII controls
    .trim()
    .slice(0, maxLength);
}

/**
 * Validates and sanitizes a URL, allowing only http: and https: protocols.
 */
export function sanitizeUrl(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const trimmed = input.trim();
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

/**
 * Safely format an error for client responses without leaking internal server details or stack traces.
 */
export function formatSafeError(error: unknown, fallbackStatus = 500): SafeErrorResult {
  if (error instanceof CampaignError) {
    return {
      ok: false,
      status: error.status,
      message: error.message,
    };
  }

  // Generate correlation ID for server debugging
  const correlationId = `err_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

  // Safe generic error message for unhandled errors
  // Raw exceptions may contain credentials, SQL parameters or reset tokens.
  console.error(`[Error ${correlationId}] Unhandled server failure.`);

  return {
    ok: false,
    status: fallbackStatus,
    message: "An internal server error occurred. Please try again later.",
    correlationId,
  };
}

/**
 * Helper to return a Response with safe error formatting.
 */
export function safeErrorResponse(error: unknown, fallbackStatus = 500): Response {
  const safe = formatSafeError(error, fallbackStatus);
  return Response.json(safe, { status: safe.status });
}
