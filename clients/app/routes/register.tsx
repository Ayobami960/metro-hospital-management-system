/**
 * Public patient self-registration.
 *
 * The server assigns the PATIENT role to every self-registered account; staff
 * accounts only exist through a single-use administrator invitation.
 */
import { useState } from "react";
import type { Route } from "./+types/register";
import { Link, useNavigate } from "react-router";
import { ArrowLeft, Eye, EyeOff, Lock, Mail, User } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSignUp } from "@/hooks/auth/use-session";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Register — HOS" },
    {
      name: "description",
      content: "Create your HOS patient portal account.",
    },
  ];
}

export default function Register() {
  const navigate = useNavigate();
  const signUp = useSignUp();
  const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pending = signUp.isPending;
  const update = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement>) =>
    setForm((current) => ({ ...current, [key]: event.target.value }));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (form.name.trim().length < 2) {
      setError("Enter your full name.");
      return;
    }
    if (!EMAIL_PATTERN.test(form.email.trim())) {
      setError("Enter a valid email address.");
      return;
    }
    if (form.password.length < 12) {
      setError("Use a password with at least 12 characters.");
      return;
    }
    if (form.password !== form.confirm) {
      setError("Passwords do not match.");
      return;
    }
    try {
      await signUp.mutateAsync({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
      });
      // better-auth creates the session on sign-up; the next screen sends and
      // verifies the email OTP, then sends the patient to profile completion.
      navigate("/login/verify", { replace: true });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to create the account.");
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-4 py-10 sm:px-6">
        <Link
          to="/login"
          className="inline-flex items-center gap-1.5 self-start rounded-lg text-sm font-semibold text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <ArrowLeft size={15} aria-hidden="true" />
          Back to sign in
        </Link>

        <h1 className="mt-6 text-2xl font-extrabold tracking-tight text-foreground">
          Create your patient account
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Patient accounts only. After creating your account we will email a verification code, then ask you to
          complete your patient profile. Staff accounts are created by hospital administrators with a one-time
          invitation.
        </p>

        <form onSubmit={submit} noValidate className="mt-7 flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <Label htmlFor="register-name">Full name</Label>
            <div className="relative">
              <User
                size={16}
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                id="register-name"
                value={form.name}
                onChange={update("name")}
                autoComplete="name"
                placeholder="Alex Morgan"
                className="h-10 pl-9"
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="register-email">Email address</Label>
            <div className="relative">
              <Mail
                size={16}
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                id="register-email"
                type="email"
                inputMode="email"
                value={form.email}
                onChange={update("email")}
                autoComplete="email"
                placeholder="you@example.com"
                className="h-10 pl-9"
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="register-password">Password</Label>
            <div className="relative">
              <Lock
                size={16}
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                id="register-password"
                type={showPassword ? "text" : "password"}
                value={form.password}
                onChange={update("password")}
                autoComplete="new-password"
                placeholder="At least 12 characters"
                className="h-10 pl-9 pr-11"
              />
              <button
                type="button"
                onClick={() => setShowPassword((visible) => !visible)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-pressed={showPassword}
                className="absolute right-1 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                {showPassword ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="register-confirm">Confirm password</Label>
            <Input
              id="register-confirm"
              type={showPassword ? "text" : "password"}
              value={form.confirm}
              onChange={update("confirm")}
              autoComplete="new-password"
              placeholder="Repeat your password"
              className="h-10"
            />
          </div>

          {error && (
            <p role="alert" className="text-xs font-medium text-destructive">
              {error}
            </p>
          )}

          <Button type="submit" disabled={pending} className="h-10 w-full rounded-xl text-sm font-bold">
            {pending ? "Creating account…" : "Create account"}
          </Button>
        </form>

        <p className="mt-6 text-xs leading-relaxed text-muted-foreground">
          Already registered?{" "}
          <Link
            to="/login"
            className="font-semibold text-foreground underline underline-offset-4 outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Sign in
          </Link>
          .
        </p>
      </main>
    </div>
  );
}
