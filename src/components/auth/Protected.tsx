import { Suspense, type ReactNode } from "react";
import { DatabaseUnavailable } from "@/components/auth/DatabaseUnavailable";
import type { Area } from "@/lib/auth/authorization";
import type { PublicUser } from "@/lib/auth/constants";
import { requireArea } from "@/lib/auth/session";

export function Protected({
  area,
  loginNext,
  children,
}: {
  area: Area;
  loginNext: string;
  children: (user: PublicUser) => ReactNode | Promise<ReactNode>;
}) {
  return (
    <Suspense fallback={<p className="px-5 py-16 text-sm text-muted">Checking access…</p>}>
      <ProtectedBody area={area} loginNext={loginNext}>
        {children}
      </ProtectedBody>
    </Suspense>
  );
}

async function ProtectedBody({
  area,
  loginNext,
  children,
}: {
  area: Area;
  loginNext: string;
  children: (user: PublicUser) => ReactNode | Promise<ReactNode>;
}) {
  const user = await requireArea(area, loginNext);
  if (user === "unavailable") {
    return <DatabaseUnavailable />;
  }
  return await children(user);
}
