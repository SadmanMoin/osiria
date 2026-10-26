import { Suspense, type ReactNode } from "react";
import { DatabaseUnavailable } from "@/components/auth/DatabaseUnavailable";
import { requireArea } from "@/lib/auth/session";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={null}>
      <AdminGate>{children}</AdminGate>
    </Suspense>
  );
}

async function AdminGate({ children }: { children: ReactNode }) {
  const user = await requireArea("admin", "/admin");
  if (user === "unavailable") {
    return <DatabaseUnavailable />;
  }
  return children;
}
