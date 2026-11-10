/**
 * Room Access — hospital staff only.
 *
 * This page verifies control of a registered hospital email with the Daily
 * Access Code. It does NOT sign anyone in. Successful verification redirects
 * to the role-specific login form, where normal credentials are still required.
 * Patients and administrators use the normal login page and never see this
 * code.
 */
import { useEffect, useState } from "react";
import type { Route } from "./+types/room";
import { Link, useNavigate } from "react-router";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
  Stethoscope,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  useRoomAccessSession,
  useSendRoomAccessCode,
  useVerifyRoomAccessCode,
} from "@/hooks/auth/use-session";
import { errorMessage } from "@/services/api/api-error";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const HOSPITAL_NAME = "MGH Hospital";

type Step = "landing" | "email" | "code";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Room Access — HOS" },
    {
      name: "description",
      content:
        "Verify your registered hospital email to receive today's room access code and open your role-specific login form.",
    },
  ];
}

export default function Room() {
  const navigate = useNavigate();
  const roomSession = useRoomAccessSession();
  const sendCode = useSendRoomAccessCode();
  const verifyCode = useVerifyRoomAccessCode();

  const [step, setStep] = useState<Step>("landing");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setInterval(() => setCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  const active = roomSession.data?.active === true;

  const submitEmail = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    const normalized = email.trim().toLowerCase();
    if (!EMAIL_PATTERN.test(normalized)) {
      setError("Enter your registered hospital email address.");
      return;
    }
    try {
      const result = await sendCode.mutateAsync({ email: normalized });
      setEmail(normalized);
      setSentTo(normalized);
      setStep("code");
      setCooldown(45);
      toast.success(result.message);
    } catch (caught) {
      setError(errorMessage(caught, "Could not request a daily access code."));
    }
  };

  const resend = async () => {
    setError(null);
    try {
      const result = await sendCode.mutateAsync({ email });
      setCooldown(45);
      toast.success(result.message);
    } catch (caught) {
      setError(errorMessage(caught, "Could not request a new code."));
    }
  };

  const submitCode = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!code.trim()) {
      setError("Enter the Daily Access Code from your email.");
      return;
    }
    try {
      const result = await verifyCode.mutateAsync({ email, code: code.trim() });
      setCode("");
      toast.success(`Verified. Continue to the ${result.portalLabel} login.`);
      navigate(result.loginPath, { replace: true });
    } catch (caught) {
      setError(errorMessage(caught, "That code is not valid or has expired."));
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6 sm:py-14">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 rounded-lg text-sm font-semibold text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <ArrowLeft size={15} aria-hidden="true" />
          Back to home
        </Link>

        <div className="mt-6 overflow-hidden rounded-2xl border border-border bg-card">
          <div className="flex items-start gap-4 border-b border-border bg-muted/50 p-5 sm:p-6">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <ShieldCheck size={22} aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">Protected area</p>
              <h1 className="mt-1 text-xl font-extrabold tracking-tight text-foreground sm:text-2xl">
                Hospital Staff Verification Required
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                Please verify your registered hospital email address to confirm that you are an authorized member of{" "}
                {HOSPITAL_NAME}.
              </p>
            </div>
          </div>

          <div className="p-5 sm:p-6">
            {active && step === "landing" && (
              <div className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
                <p className="font-bold">Room access is already verified for this session.</p>
                <p className="mt-1 text-xs leading-relaxed">
                  Continue to the {roomSession.data?.portalLabel ?? "staff"} login form. You still need your normal
                  account credentials.
                </p>
                <Button
                  type="button"
                  className="mt-3 h-9 rounded-lg text-xs font-bold"
                  onClick={() => navigate(roomSession.data?.loginPath ?? "/login?role=doctor")}
                >
                  Continue to staff login
                  <ArrowRight size={14} aria-hidden="true" />
                </Button>
              </div>
            )}

            {step === "landing" && (
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setStep("email");
                }}
                className="group flex w-full flex-col gap-3 rounded-2xl border border-border bg-background p-5 text-left outline-none transition-colors hover:border-foreground/25 hover:bg-muted/60 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 sm:p-6"
              >
                <span className="flex items-center justify-between gap-3">
                  <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Mail size={20} aria-hidden="true" />
                  </span>
                  <ArrowRight
                    size={18}
                    className="text-muted-foreground transition-transform group-hover:translate-x-0.5"
                    aria-hidden="true"
                  />
                </span>
                <span>
                  <span className="block text-base font-bold text-foreground">Verify Your Hospital Identity</span>
                  <span className="mt-1 block text-sm leading-relaxed text-muted-foreground">
                    Click here to receive your daily access code by email.
                  </span>
                </span>
              </button>
            )}

            {step === "email" && (
              <form onSubmit={submitEmail} noValidate className="flex flex-col gap-5">
                <div>
                  <h2 className="text-lg font-bold text-foreground">Hospital email verification</h2>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    Enter the email address registered to your hospital staff account. We will send a one-time Daily
                    Access Code to that inbox.
                  </p>
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="room-email">Registered hospital email</Label>
                  <div className="relative">
                    <Mail
                      size={16}
                      aria-hidden="true"
                      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                    />
                    <Input
                      id="room-email"
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="you@hospital.org"
                      className="h-10 pl-9"
                    />
                  </div>
                </div>

                {error && (
                  <p role="alert" className="text-xs font-medium text-destructive">
                    {error}
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-3">
                  <Button type="submit" disabled={sendCode.isPending} className="h-10 rounded-xl px-5 text-sm font-bold">
                    {sendCode.isPending ? (
                      <>
                        <Loader2 size={15} className="animate-spin" aria-hidden="true" /> Sending code…
                      </>
                    ) : (
                      "Send Daily Access Code"
                    )}
                  </Button>
                  <button
                    type="button"
                    onClick={() => {
                      setStep("landing");
                      setError(null);
                    }}
                    className="rounded text-xs font-semibold text-muted-foreground underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    Back
                  </button>
                </div>
              </form>
            )}

            {step === "code" && (
              <form onSubmit={submitCode} noValidate className="flex flex-col gap-5">
                <div>
                  <h2 className="text-lg font-bold text-foreground">Enter Your Daily Access Code</h2>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    Enter the verification code sent to your registered hospital email address to continue.
                    {sentTo && (
                      <>
                        {" "}
                        Sent to <span className="font-semibold text-foreground">{sentTo}</span>.
                      </>
                    )}
                  </p>
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="room-code">Daily Access Code</Label>
                  <div className="relative">
                    <KeyRound
                      size={16}
                      aria-hidden="true"
                      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                    />
                    <Input
                      id="room-code"
                      value={code}
                      onChange={(event) => setCode(event.target.value)}
                      autoComplete="one-time-code"
                      inputMode="numeric"
                      maxLength={8}
                      placeholder="12345678"
                      className="h-10 pl-9 tracking-[0.2em]"
                    />
                  </div>
                </div>

                {error && (
                  <p role="alert" className="text-xs font-medium text-destructive">
                    {error}
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-3">
                  <Button type="submit" disabled={verifyCode.isPending} className="h-10 rounded-xl px-5 text-sm font-bold">
                    {verifyCode.isPending ? (
                      <>
                        <Loader2 size={15} className="animate-spin" aria-hidden="true" /> Verifying…
                      </>
                    ) : (
                      "Verify and Continue"
                    )}
                  </Button>
                  <button
                    type="button"
                    onClick={resend}
                    disabled={sendCode.isPending || cooldown > 0}
                    className="rounded text-xs font-semibold text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60"
                  >
                    {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setStep("email");
                      setCode("");
                      setError(null);
                    }}
                    className="rounded text-xs font-semibold text-muted-foreground underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    Use a different email
                  </button>
                </div>

                <p className="flex items-start gap-2 rounded-xl bg-muted p-3 text-xs leading-relaxed text-muted-foreground">
                  <Lock size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
                  This code only unlocks your staff login form. It is not your password and does not sign you in.
                </p>
              </form>
            )}
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <Link
            to="/login?role=patient"
            className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 outline-none transition-colors hover:border-foreground/25 hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <span className="flex size-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <Stethoscope size={18} aria-hidden="true" />
            </span>
            <span>
              <span className="block text-sm font-bold text-foreground">Patient Login</span>
              <span className="block text-xs text-muted-foreground">No daily access code required</span>
            </span>
          </Link>
          <Link
            to="/login?role=administration"
            className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 outline-none transition-colors hover:border-foreground/25 hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <span className="flex size-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <Building2 size={18} aria-hidden="true" />
            </span>
            <span>
              <span className="block text-sm font-bold text-foreground">Administrator Login</span>
              <span className="block text-xs text-muted-foreground">No daily access code required</span>
            </span>
          </Link>
        </div>
      </main>
    </div>
  );
}
