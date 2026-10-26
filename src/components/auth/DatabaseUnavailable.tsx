import { Card } from "@/components/ui/Card";
import { Container } from "@/components/ui/Container";
import { DATABASE_UNAVAILABLE_MESSAGE } from "@/lib/auth/constants";

export function DatabaseUnavailable() {
  return (
    <Container className="py-16">
      <Card className="max-w-xl">
        <h1 className="font-display text-3xl tracking-tight">Database unavailable</h1>
        <p className="mt-4 text-sm leading-6 text-muted">{DATABASE_UNAVAILABLE_MESSAGE}</p>
      </Card>
    </Container>
  );
}
