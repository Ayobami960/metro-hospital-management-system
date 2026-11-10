
import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { ArrowLeft, CheckCircle2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import PatientProfileWizard, {
  PatientBrandPanel,
} from "@/components/auth/patient-profile-wizard";
import type { PatientWizardSubmit } from "@/components/auth/patient-profile-wizard";
import { usePatientRegistration, useSignIn, useSignUp } from "@/hooks/auth/use-session";
import { authApi } from "@/services/auth/auth.api";
import { errorMessage } from "@/services/api/api-error";

export function meta() {
  return [
    { title: "Patient registration — MGH Hospital" },
    {
      name: "description",
      content: "Register as a patient at MGH Hospital with our secure five-step form.",
    },
  ];
}

export default function Register() {
  const navigate = useNavigate();
  const signUp = useSignUp();
  const signIn = useSignIn();
  const saveRegistration = usePatientRegistration();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const submitting = signUp.isPending || signIn.isPending || saveRegistration.isPending;

  const handleSubmit = async ({ patient, email, password }: PatientWizardSubmit, files: File[]) => {
    if (done) return;
    if (!password) {
      setError("Enter a password to create your account.");
      return;
    }
    setError(null);
    const name = `${patient.firstName} ${patient.lastName}`.trim();

    try {
      try {
        await signUp.mutateAsync({ name, email, password });
      } catch (signUpError) {
        // A previous attempt may already have created the credential; resume the
        // rest of registration if the password still matches that account.
        try {
          await signIn.mutateAsync({ email, password });
        } catch {
          throw signUpError;
        }
      }

      try {
        await saveRegistration.mutateAsync(patient);
      } catch (registrationError) {
        const message = errorMessage(registrationError, "");
        // A retried submission after a partial failure resumes instead of
        // restarting: the saved profile is still waiting for verification.
        if (!/already (been )?saved|already verified/i.test(message)) throw registrationError;
      }

      let failedUploads = 0;
      for (const file of files) {
        try {
          await authApi.uploadOnboardingDocument(file);
        } catch {
          failedUploads += 1;
        }
      }
      if (failedUploads > 0) {
        toast.warning(
          `${failedUploads} document${failedUploads === 1 ? "" : "s"} could not be uploaded. You can add them during profile completion.`,
        );
      }

      setDone(true);
      navigate("/verify-email", { replace: true });
    } catch (caught) {
      const message = errorMessage(caught, "Unable to create your account.");
      setError(
        /already/i.test(message)
          ? "An account with this email already exists. Sign in instead."
          : message,
      );
    }
  };

  if (done) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted p-6">
        <div className="w-full max-w-md rounded-3xl border border-border bg-card p-10 text-center shadow-xl">
          <div className="mx-auto mb-6 flex size-20 items-center justify-center rounded-full bg-emerald-100 ring-8 ring-emerald-50 dark:bg-emerald-500/15 dark:ring-emerald-500/5">
            <CheckCircle2 size={40} className="text-emerald-600 dark:text-emerald-400" />
          </div>
          <h2 className="text-2xl font-extrabold tracking-tight text-foreground">Account created</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Check your email for a verification code, then complete your patient profile.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted text-foreground lg:grid lg:grid-cols-[400px_1fr]">
      <PatientBrandPanel
        title="Your health records, in one secure place."
        description="Book appointments, view prescriptions and lab results, and stay connected with your care team."
      />

      <main className="flex min-h-screen flex-col px-4 py-6 sm:px-8">
        <header className="mx-auto flex w-full max-w-2xl items-center justify-between">
          <Link
            to="/login"
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-muted-foreground transition hover:bg-muted"
          >
            <ArrowLeft size={16} /> Back to sign in
          </Link>
          <div className="flex items-center gap-2 lg:hidden">
            <span className="flex size-8 items-center justify-center rounded-lg bg-blue-600 text-[10px] font-extrabold text-white">
              MGH
            </span>
            <span className="text-sm font-extrabold">MGH Hospital</span>
          </div>
        </header>

        <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center py-8">
          <PatientProfileWizard
            mode="register"
            submitting={submitting}
            error={error}
            onSubmit={handleSubmit}
          />

          <div className="mt-5 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
            <ShieldCheck size={14} /> Secured with 256-bit encryption
          </div>

          <p className="mt-4 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link to="/login" className="font-semibold text-blue-600 hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
