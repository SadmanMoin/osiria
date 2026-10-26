export type ResetDeliveryMode = "webhook" | "development-log" | "unconfigured";

export function resetDeliveryMode(env: {
  nodeEnv?: string;
  webhook?: string;
}): ResetDeliveryMode {
  if (env.webhook?.trim()) {
    return "webhook";
  }
  if (env.nodeEnv !== "production") {
    return "development-log";
  }
  return "unconfigured";
}

export function maskEmail(email: string): string {
  const [name, domain] = email.split("@");
  if (!name || !domain) {
    return "hidden";
  }
  return `${name.slice(0, 1)}***@${domain}`;
}

export function resetUrl(origin: string, token: string): string {
  const url = new URL("/reset-password", origin);
  url.searchParams.set("token", token);
  return url.toString();
}

export async function deliverPasswordReset(input: { to: string; resetUrl: string }): Promise<void> {
  const webhook = process.env.AUTH_EMAIL_WEBHOOK;
  const mode = resetDeliveryMode({
    nodeEnv: process.env.NODE_ENV,
    webhook,
  });

  if (mode === "webhook" && webhook) {
    const response = await fetch(webhook, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        type: "password_reset",
        to: input.to,
        resetUrl: input.resetUrl,
      }),
    });
    if (!response.ok) {
      throw new Error("Password reset delivery failed");
    }
    return;
  }

  if (mode === "development-log") {
    console.info(`Password reset link issued for ${maskEmail(input.to)}.`);
    console.info(input.resetUrl);
    return;
  }

  console.error("Password reset email was not sent. Set AUTH_EMAIL_WEBHOOK.");
}
