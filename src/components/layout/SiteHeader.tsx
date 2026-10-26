import { Suspense } from "react";
import { Header } from "@/components/layout/Header";
import { getOptionalUser } from "@/lib/auth/session";

export function SiteHeader() {
  return (
    <Suspense fallback={null}>
      <SignedInHeader />
    </Suspense>
  );
}

async function SignedInHeader() {
  const user = await getOptionalUser();
  return (
    <Header
      user={user ? { displayName: user.displayName, role: user.role } : null}
    />
  );
}
