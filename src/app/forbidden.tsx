import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";

export default function Forbidden() {
  return (
    <Container className="py-24 text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-accent">403</p>
      <h1 className="mt-4 font-display text-4xl tracking-tight">Access denied</h1>
      <p className="mx-auto mt-4 max-w-md text-muted">
        Your account is signed in, and this area requires a different role. Admin pages stay on
        the server.
      </p>
      <div className="mt-8 flex justify-center">
        <Button href="/">Back home</Button>
      </div>
    </Container>
  );
}
