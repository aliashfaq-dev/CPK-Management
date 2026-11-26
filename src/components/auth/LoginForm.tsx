"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useId, useState, type FormEvent } from "react";
import { faEye, faEyeSlash } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { fieldClass } from "@/components/ui/field";
import { cn } from "@/lib/utils";

interface LoginFormProps {
  setupNotice?: string | null;
  nextPath?: string;
}

export function LoginForm({ setupNotice = null, nextPath = "/" }: LoginFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const passwordId = useId();
  const errorId = useId();

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting) return;
    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(body?.error ?? "Sign-in failed.");
        setSubmitting(false);
        return;
      }
      router.replace(nextPath);
      router.refresh();
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
      setSubmitting(false);
    }
  };

  return (
    <Card className="w-full max-w-md p-6 sm:p-8">
      <div className="flex flex-col items-center text-center">
        <Image src="/images/cpk-logo.jpeg" alt="CPK Community Policing Karachi emblem" width={230} height={244} priority className="h-32 w-auto object-contain" />
        <p className="mt-3 flex items-center gap-2 text-2xl font-bold leading-none text-accent">
          CPK
          <span className="rounded bg-danger px-1.5 py-0.5 text-[10px] font-semibold text-white">KARACHI</span>
        </p>
      </div>

      <h1 className="mt-6 text-center text-base font-semibold">Sign in to your account</h1>

      {setupNotice && (
        <p role="status" className="mt-4 rounded-md border border-warning/30 bg-warning/10 px-3 py-2.5 text-sm text-warning-strong">
          {setupNotice}
        </p>
      )}

      <form onSubmit={onSubmit} noValidate className="mt-5 space-y-4">
        <Input
          label="Email"
          type="email"
          name="email"
          autoComplete="email"
          autoFocus
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          aria-describedby={error ? errorId : undefined}
          className={cn("h-10", error && "border-danger")}
        />

        <div className="space-y-1.5">
          <label htmlFor={passwordId} className="block text-xs font-medium">
            Password
          </label>
          <div className="relative">
            <input
              id={passwordId}
              suppressHydrationWarning
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? errorId : undefined}
              className={cn(fieldClass, "h-10 pr-11", error && "border-danger")}
            />
            <button
              type="button"
              suppressHydrationWarning
              onClick={() => setShowPassword((value) => !value)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
              className="absolute right-1 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-muted transition-colors hover:bg-subtle hover:text-fg"
            >
              <FontAwesomeIcon icon={showPassword ? faEyeSlash : faEye} />
            </button>
          </div>
        </div>

        {error && (
          <p id={errorId} role="alert" className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger-strong">
            {error}
          </p>
        )}

        <Button type="submit" variant="primary" className="h-10 w-full" disabled={submitting || Boolean(setupNotice)}>
          {submitting ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </Card>
  );
}
