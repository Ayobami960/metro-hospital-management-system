/**
 * Post-password account stages:
 *   email verification → profile completion → optional 2FA → patient login OTP.
 *
 * The next step is decided by the server (`GET /account/status`), never by the
 * browser, and the dashboard stays closed until it returns READY. The Daily
 * Room Access Code is not part of this screen.
 */
import { useEffect, useState } from "react";
import type { Route } from "./+types/login-verify";
import { Link, Navigate, useNavigate } from "react-router";
import { KeyRound, Loader2, LogOut, Mail, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  useAccountStatus,
  useResendEmailVerification,
  useResendPatientOtp,
  useSignOut,
  useVerifyEmail,
  useVerifyPatientOtp,
  useVerifyRecoveryCode,
  useVerifyTotp,
} from "@/hooks/auth/use-session";
import { errorMessage } from "@/services/api/api-error";
import { getRoleHomeRoute } from "@/data";
import type { roles } from "@/types";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Verify sign-in — HOS" },
    { name: "description", content: "Complete the next step of your secure sign-in." },
  ];
}

export default function LoginVerify() {
  const navigate = useNavigate();
  const status = useAccountStatus();
  const signOut = useSignOut();
  const verifyTotp = useVerifyTotp();
  const verifyRecovery = useVerifyRecoveryCode();
  const verifyEmail = useVerifyEmail();
  const resendEmail = useResendEmailVerification();
  const verifyPatient = useVerifyPatientOtp();
  const resendPatient = useResendPatientOtp();

  const [totpMode, setTotpMode] = useState<"TOTP" | "RECOVERY">("TOTP");
  const [code, setCode] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  const nextStep = status.data?.nextStep;

  useEffect(() => {
    if (!status.data) return;
    if (status.data.nextStep === "READY") {
      navigate(getRoleHomeRoute(status.data.user.role as roles), { replace: true });
    } else if (status.data.nextStep === "ONBOARDING") {
      navigate(
        status.data.user.role === "PATIENT" ? "/patient/complete-profile" : "/complete-profile",
        { replace: true },
      );
    }
  }, [status.data, navigate]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setInterval(() => setCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  useEffect(() => {
    if (nextStep === "EMAIL_VERIFICATION" || nextStep === "PATIENT_OTP") {
      setCooldown((value) => (value > 0 ? value : 45));
    }
  }, [nextStep]);

  if (status.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-muted-foreground" aria-label="Checking sign-in" />
      </div>
    );
  }

  if (status.isError || !status.data) {
    // No usable session: back to the password step.
    return <Navigate to="/login" replace />;
  }

  const submittingTotp = verifyTotp.isPending || verifyRecovery.isPending;
  const submittingEmail = verifyEmail.isPending || verifyPatient.isPending;

  const submitSecondFactor = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!code.trim()) return;
    setAuthError(null);
    try {
      await (totpMode === "TOTP"
        ? verifyTotp.mutateAsync({ code: code.trim() })
        : verifyRecovery.mutateAsync({ code: code.trim() }));
      setCode("");
    } catch (error) {
      setAuthError(
        errorMessage(
          error,
          totpMode === "TOTP" ? "That authenticator code is not valid." : "That recovery code is not valid.",
        ),
      );
    }
  };

  const submitEmailCode = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!otpCode.trim()) return;
    setAuthError(null);
    try {
      await verifyEmail.mutateAsync({ code: otpCode.trim() });
      setOtpCode("");
      toast.success("Email verified");
    } catch (error) {
      setAuthError(errorMessage(error, "That verification code is not valid."));
    }
  };

  const submitPatientCode = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!otpCode.trim()) return;
    setAuthError(null);
    try {
      const result = await verifyPatient.mutateAsync({ code: otpCode.trim() });
      setOtpCode("");
      if (result.nextStep === "READY") toast.success("Verified — welcome back.");
    } catch (error) {
      setAuthError(errorMessage(error, "That sign-in code is not valid."));
    }
  };

  const resendCode = (kind: "email" | "patient") => {
    const mutation = kind === "email" ? resendEmail : resendPatient;
    mutation.mutate(undefined, {
      onSuccess: (result) => {
        setSentTo(result.sentTo);
        setCooldown(45);
        setAuthError(null);
        toast.success(
          result.delivered
            ? `A new code was sent to ${result.sentTo}.`
            : "We could not send the email. Try again shortly.",
        );
      },
      onError: (error) => toast.error(errorMessage(error, "Could not request a new code.")),
    });
  };

  const showEmailCode = nextStep === "EMAIL_VERIFICATION";
  const showPatientCode = nextStep === "PATIENT_OTP";
  const showOtp = showEmailCode || showPatientCode;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-4 py-10 sm:px-6">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 self-start rounded-lg text-sm font-semibold text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <LogOut size={15} aria-hidden="true" />
          Back to home
        </Link>

        <div className="mt-6 flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            {nextStep === "TOTP" ? (
              <ShieldCheck size={20} />
            ) : showPatientCode ? (
              <KeyRound size={20} />
            ) : (
              <Mail size={20} />
            )}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-foreground">{status.data.user.name}</p>
            <p className="truncate text-xs text-muted-foreground">{status.data.user.email}</p>
          </div>
        </div>

        {nextStep === "TOTP" && (
          <>
            <h1 className="mt-6 text-2xl font-extrabold tracking-tight text-foreground">
              Two-factor verification
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Enter the {totpMode === "TOTP" ? "6-digit code from your authenticator app" : "single-use recovery code"} to
              continue.
            </p>
            <form onSubmit={submitSecondFactor} className="mt-7 flex flex-col gap-5">
              <div className="flex flex-col gap-2">
                <Label htmlFor="verify-code">
                  {totpMode === "TOTP" ? "Authenticator code" : "Recovery code"}
                </Label>
                <div className="relative">
                  <KeyRound
                    size={16}
                    aria-hidden="true"
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  />
                  <Input
                    id="verify-code"
                    value={code}
                    onChange={(event) => setCode(event.target.value)}
                    autoComplete="one-time-code"
                    inputMode={totpMode === "TOTP" ? "numeric" : "text"}
                    placeholder={totpMode === "TOTP" ? "123456" : "XXXX-XXXX"}
                    className="h-10 pl-9 tracking-[0.2em]"
                  />
                </div>
              </div>

              {authError && (
                <p role="alert" className="text-xs font-medium text-destructive">
                  {authError}
                </p>
              )}

              <Button type="submit" disabled={submittingTotp} className="h-10 w-full rounded-xl text-sm font-bold">
                {submittingTotp ? "Verifying…" : "Verify"}
              </Button>

              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setTotpMode((mode) => (mode === "TOTP" ? "RECOVERY" : "TOTP"));
                    setCode("");
                    setAuthError(null);
                  }}
                  className="rounded text-xs font-semibold text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  {totpMode === "TOTP" ? "Use a recovery code instead" : "Use an authenticator code"}
                </button>
                <button
                  type="button"
                  onClick={() => signOut.mutate()}
                  className="rounded text-xs font-semibold text-muted-foreground underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  Sign out
                </button>
              </div>
            </form>
          </>
        )}

        {showOtp && (
          <>
            <h1 className="mt-6 text-2xl font-extrabold tracking-tight text-foreground">
              {showEmailCode ? "Verify your hospital email" : "Enter your patient sign-in code"}
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {showEmailCode
                ? "Enter the one-time code sent to your registered email address to finish creating your account."
                : "Enter the one-time code we emailed to your registered address to finish signing in."}
              {status.data.verificationSentTo && (
                <>
                  {" "}
                  Sent to <span className="font-semibold text-foreground">{status.data.verificationSentTo}</span>.
                </>
              )}
            </p>

            <form
              onSubmit={showEmailCode ? submitEmailCode : submitPatientCode}
              className="mt-7 flex flex-col gap-5"
            >
              <div className="flex flex-col gap-2">
                <Label htmlFor="otp-code">Verification code</Label>
                <div className="relative">
                  <Mail
                    size={16}
                    aria-hidden="true"
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  />
                  <Input
                    id="otp-code"
                    value={otpCode}
                    onChange={(event) => setOtpCode(event.target.value)}
                    autoComplete="one-time-code"
                    inputMode="numeric"
                    maxLength={8}
                    placeholder="12345678"
                    className="h-10 pl-9 tracking-[0.2em]"
                  />
                </div>
              </div>

              {authError && (
                <p role="alert" className="text-xs font-medium text-destructive">
                  {authError}
                </p>
              )}

              <Button type="submit" disabled={submittingEmail} className="h-10 w-full rounded-xl text-sm font-bold">
                {submittingEmail ? "Checking…" : "Verify and continue"}
              </Button>

              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => resendCode(showEmailCode ? "email" : "patient")}
                  disabled={(showEmailCode ? resendEmail.isPending : resendPatient.isPending) || cooldown > 0}
                  className="rounded text-xs font-semibold text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60"
                >
                  {cooldown > 0
                    ? `Resend in ${cooldown}s`
                    : showEmailCode
                      ? "Resend code"
                      : "Send a new code"}
                </button>
                <button
                  type="button"
                  onClick={() => signOut.mutate()}
                  className="rounded text-xs font-semibold text-muted-foreground underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  Sign out
                </button>
              </div>
              {sentTo && <p className="text-xs text-muted-foreground">Last code sent to {sentTo}.</p>}
            </form>
          </>
        )}

        {(nextStep === "ONBOARDING" || nextStep === "READY") && (
          <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            {nextStep === "ONBOARDING" ? "Opening your profile…" : "Loading your workspace…"}
          </div>
        )}
      </main>
    </div>
  );
}
