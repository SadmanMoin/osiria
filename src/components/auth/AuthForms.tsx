"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import {
  forgotPasswordAction,
  loginAction,
  registerAction,
  resetPasswordAction,
} from "@/lib/auth/actions";
import type { FormState } from "@/lib/auth/constants";

const fieldClass =
  "mt-2 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none ring-accent/40 placeholder:text-muted focus:ring-2";

const initialState: FormState = {};

function Status({ state }: { state: FormState }) {
  if (!state.error && !state.message) {
    return null;
  }
  return (
    <p role="alert" className={`text-sm ${state.error ? "text-danger" : "text-teal"}`}>
      {state.error ?? state.message}
    </p>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) {
    return null;
  }
  return <span className="mt-1 block text-xs text-danger">{message}</span>;
}

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(loginAction, initialState);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <label className="block text-sm" htmlFor="email">
        Email
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className={fieldClass}
          aria-invalid={Boolean(state.fieldErrors?.email)}
        />
        <FieldError message={state.fieldErrors?.email} />
      </label>
      <label className="block text-sm" htmlFor="password">
        Password
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className={fieldClass}
          aria-invalid={Boolean(state.fieldErrors?.password)}
        />
        <FieldError message={state.fieldErrors?.password} />
      </label>
      <Status state={state} />
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}

export function RegisterForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(registerAction, initialState);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <label className="block text-sm" htmlFor="displayName">
        Name
        <input
          id="displayName"
          name="displayName"
          type="text"
          autoComplete="name"
          required
          minLength={2}
          maxLength={80}
          className={fieldClass}
          aria-invalid={Boolean(state.fieldErrors?.displayName)}
        />
        <FieldError message={state.fieldErrors?.displayName} />
      </label>
      <label className="block text-sm" htmlFor="email">
        Email
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className={fieldClass}
          aria-invalid={Boolean(state.fieldErrors?.email)}
        />
        <FieldError message={state.fieldErrors?.email} />
      </label>
      <fieldset className="space-y-2">
        <legend className="text-sm">Role</legend>
        <label className="flex items-center gap-2 text-sm">
          <input type="radio" name="role" value="WORKER" defaultChecked />
          Worker — complete social tasks
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="radio" name="role" value="ADVERTISER" />
          Advertiser — fund campaigns
        </label>
        <FieldError message={state.fieldErrors?.role} />
        <p className="text-xs leading-5 text-muted">
          Admin accounts are not created from this form.
        </p>
      </fieldset>
      <label className="block text-sm" htmlFor="password">
        Password
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={12}
          className={fieldClass}
          aria-invalid={Boolean(state.fieldErrors?.password)}
        />
        <FieldError message={state.fieldErrors?.password} />
      </label>
      <label className="block text-sm" htmlFor="confirmPassword">
        Confirm password
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          minLength={12}
          className={fieldClass}
          aria-invalid={Boolean(state.fieldErrors?.confirmPassword)}
        />
        <FieldError message={state.fieldErrors?.confirmPassword} />
      </label>
      <p className="text-xs leading-5 text-muted">
        Use at least 12 characters, with a letter and a number.
      </p>
      <Status state={state} />
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Creating account…" : "Create account"}
      </Button>
    </form>
  );
}

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(forgotPasswordAction, initialState);

  return (
    <form action={action} className="space-y-4">
      <label className="block text-sm" htmlFor="email">
        Email
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className={fieldClass}
          aria-invalid={Boolean(state.fieldErrors?.email)}
        />
        <FieldError message={state.fieldErrors?.email} />
      </label>
      <Status state={state} />
      {state.message ? (
        <p className="text-sm text-muted">
          <Link href="/login" className="text-accent hover:underline">
            Return to log in
          </Link>
        </p>
      ) : null}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Sending…" : "Send reset link"}
      </Button>
    </form>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(resetPasswordAction, initialState);

  if (!token) {
    return (
      <p className="text-sm text-muted">
        This reset link is missing a token.{" "}
        <Link href="/forgot-password" className="text-accent hover:underline">
          Request a new one
        </Link>
        .
      </p>
    );
  }

  if (state.message) {
    return (
      <div className="space-y-4">
        <Status state={state} />
        <Button href="/login" className="w-full">
          Sign in
        </Button>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <label className="block text-sm" htmlFor="password">
        New password
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={12}
          className={fieldClass}
          aria-invalid={Boolean(state.fieldErrors?.password)}
        />
        <FieldError message={state.fieldErrors?.password} />
      </label>
      <label className="block text-sm" htmlFor="confirmPassword">
        Confirm new password
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          minLength={12}
          className={fieldClass}
          aria-invalid={Boolean(state.fieldErrors?.confirmPassword)}
        />
        <FieldError message={state.fieldErrors?.confirmPassword} />
      </label>
      <Status state={state} />
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Updating…" : "Update password"}
      </Button>
    </form>
  );
}
