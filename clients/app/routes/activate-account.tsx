/**
 * Staff invitation acceptance. The token is single use, arrives by email, and
 * carries the role + hospital ID assigned by the administrator — the form can
 * only set the password and display name.
 */
import { useEffect, useState } from "react";
import type { Route } from "./+types/activate-account";
import { Link, useNavigate, useSearchParams } from "react-router";
import { ArrowLeft, CheckCircle2, KeyRound, Loader2, Mail } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAcceptInvitation, useInvitation, useSignIn } from "@/hooks/auth/use-session";
import { errorMessage } from "@/services/api/api-error";
import { label as toLabel } from "@/lib/format";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Activate your account — HOS" },
    { name: "description", content: "Set your password with your single-use staff invitation." },
  ];
}

export default function ActivateAccount() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const invitation = useInvitation(token);
  const accept = useAcceptInvitation();
  const signIn = useSignIn();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  useEffect(() => {
    if (invitation.data) setName(invitation.data.name);
  }, [invitation.data]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!token || !invitation.data) return;
    if (password.length < 12) {
      toast.error("Use a password with at least 12 characters.");
      return;
    }
    if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
      toast.error("Include at least one letter and one number.");
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords do not match.");
      return;
    }
    try {
      await accept.mutateAsync({ token, password, name: name.trim() || undefined });
      // Sign in so the session can complete email verification and profile
      // onboarding. No staff dashboard is reachable before both are done.
      await signIn.mutateAsync({ email: invitation.data.email, password });
      toast.success("Account activated. Verify your email to continue.");
      navigate("/login/verify", { replace: true });
    } catch (error) {
      toast.error(errorMessage(error, "Could not activate the account."));
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
          Activate your staff account
        </h1>

        {!token && (
          <p role="alert" className="mt-3 text-sm text-destructive">
            This link is missing its invitation token. Use the link from your invitation email.
          </p>
        )}

        {token && invitation.isLoading && (
          <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            Checking your invitation…
          </div>
        )}

        {token && invitation.isError && (
          <p role="alert" className="mt-3 text-sm text-destructive">
            {errorMessage(invitation.error, "This invitation link is not valid or has expired.")}
          </p>
        )}

        {invitation.data && (
          <>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Welcome, {invitation.data.name}. Set a password for{" "}
              <span className="font-semibold text-foreground">{invitation.data.email}</span> to finish
              activating your {toLabel(invitation.data.role)} account.
            </p>

            <form onSubmit={submit} noValidate className="mt-7 flex flex-col gap-5">
              <div className="flex flex-col gap-2">
                <Label>Email address</Label>
                <div className="relative">
                  <Mail
                    size={16}
                    aria-hidden="true"
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  />
                  <Input value={invitation.data.email} readOnly className="h-10 pl-9 opacity-70" />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="activate-name">Display name</Label>
                <Input
                  id="activate-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  autoComplete="name"
                  className="h-10"
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="activate-password">New password</Label>
                <div className="relative">
                  <KeyRound
                    size={16}
                    aria-hidden="true"
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  />
                  <Input
                    id="activate-password"
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete="new-password"
                    placeholder="At least 12 characters"
                    className="h-10 pl-9"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="activate-confirm">Confirm password</Label>
                <Input
                  id="activate-confirm"
                  type="password"
                  value={confirm}
                  onChange={(event) => setConfirm(event.target.value)}
                  autoComplete="new-password"
                  className="h-10"
                />
              </div>

              <Button type="submit" disabled={accept.isPending} className="h-10 w-full rounded-xl text-sm font-bold">
                {accept.isPending || signIn.isPending ? "Activating…" : "Activate account"}
              </Button>

              <p className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
                <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-emerald-600" aria-hidden="true" />
                This link works once. Next you will verify your registered email address and complete your
                staff profile. The Daily Room Access Code is only used later, when you sign in to your room.
              </p>
            </form>
          </>
        )}
      </main>
    </div>
  );
}
