import { checkDatabaseHealth } from "@/lib/db/health";

export async function GET() {
  const result = await checkDatabaseHealth();

  return Response.json(
    {
      ok: result.ok,
      configured: result.configured,
      message: result.message,
    },
    { status: result.ok ? 200 : 503 },
  );
}
