/**
 * Portal sign-in.
 *
 * Staff forms are only usable after the Daily Room Access Code has verified the
 * hospital email; the role shown here is read from the server-side Room Access
 * session, never from the URL. Administrators and patients use the normal form
 * without a room code. The server still resolves the actual role and dashboard
 * after the password is accepted.
 */
import { useEffect, useState } from "react";
import type { Route } from "./+types/login";
import { Link, useNavigate, useSearchParams } from "react-router";
import { useSession, useSignIn, useRoomAccessSession } from "@/hooks/auth/use-session";
import { useForm } from "react-hook-form";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
  Stethoscope,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  getRoleHomeRoute,
  getStaffPortal,
  isStaffPortalSlug,
  roleColors,
  roleLabels,
  staffPortals,
} from "@/data";
import type { roles } from "@/types";
import type { RoomAccessRole } from "@/types/api.types";

interface LoginFormValues {
  email: string;
  password: string;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

interface PortalView {
  label?: string;
  description: string;
  color: string;
  icon: LucideIcon;
  role?: roles;
  slug?: string;
}

const patientPortal: PortalView = {
  label: roleLabels.PATIENT,
  description: "View your appointments, results, prescriptions and bills.",
  color: roleColors.PATIENT,
  icon: Stethoscope,
  role: "PATIENT",
  slug: "patient",
};

const administratorPortal: PortalView = {
  label: "Administrator",
  description: "Hospital-wide operations, staff accounts and reporting.",
  color: roleColors.ADMIN,
  icon: Building2,
  role: "ADMIN",
  slug: "administration",
};

function resolvePortal(roleParam: string | null, roomRole: RoomAccessRole | undefined): PortalView {
  if (roomRole) {
    const portal = staffPortals.find((entry) => entry.role === roomRole);
    if (portal) {
      return {
        label: portal.label,
        description: `Room access verified. Sign in with your normal ${portal.name} account credentials.`,
        color: portal.color,
        icon: portal.icon,
        role: portal.role,
        slug: portal.slug,
      };
    }
  }

  if (roleParam === "patient") return patientPortal;
  if (roleParam === "administration") return administratorPortal;

  const portal = isStaffPortalSlug(roleParam) ? getStaffPortal(roleParam) : undefined;
  if (portal && portal.slug !== "administration") {
    return {
      label: portal.label,
      description: portal.description,
      color: portal.color,
      icon: portal.icon,
      role: portal.role,
      slug: portal.slug,
    };
  }

  return {
    description: "Sign in with your hospital account to continue.",
    color: roleColors.ADMIN,
    icon: Building2,
  };
}

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Sign in — HOS" },
    {
      name: "description",
      content: "Sign in to your HOS hospital portal.",
    },
  ];
}

export default function Login() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const signIn = useSignIn();
  const { data: session } = useSession();

  const roleParam = searchParams.get("role");
  const staffPortalSlug = isStaffPortalSlug(roleParam) && roleParam !== "administration" ? roleParam : null;
  const roomSession = useRoomAccessSession({ enabled: Boolean(staffPortalSlug) });

  const roomRole = roomSession.data?.active ? roomSession.data.role : undefined;
  const portal = resolvePortal(roleParam, roomRole);
  const Icon = portal.icon;
  const isStaffPortal = Boolean(staffPortalSlug);
  const roomRequired = isStaffPortal && !roomRole && !roomSession.isLoading;
  const heading = portal.label ? `${portal.label} Login` : "Sign in to HOS";

  useEffect(() => {
    if (session) navigate(getRoleHomeRoute(session.role), { replace: true });
  }, [session, navigate]);

  // A verified Room Access session fixes the portal; a tampered `?role=` cannot
  // change the role that will actually be used at sign-in.
  useEffect(() => {
    if (!roomRole) return;
    const expected = staffPortals.find((entry) => entry.role === roomRole)?.slug;
    if (expected && roleParam !== expected) {
      navigate(`/login?role=${expected}`, { replace: true });
    }
  }, [roomRole, roleParam, navigate]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({ mode: "onTouched" });

  const onSubmit = handleSubmit(async (values) => {
    setAuthError(null);
    try {
      await signIn.mutateAsync(values);
      // The server resolves the remaining account stages (email verification,
      // onboarding, 2FA or patient OTP) before any dashboard opens.
      navigate("/login/verify", { replace: true });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to sign in with those credentials.";
      setAuthError(
        isStaffPortal && !roomRole
          ? "Verify your Room Access Daily Code before signing in to a staff portal."
          : message,
      );
    }
  });

  if (isStaffPortal && roomSession.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-muted-foreground" aria-label="Checking room access" />
      </div>
    );
  }

  if (roomRequired) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-10 sm:px-6">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 self-start rounded-lg text-sm font-semibold text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <ArrowLeft size={15} aria-hidden="true" /> Back to home
          </Link>

          <span className="mt-6 flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <ShieldCheck size={22} aria-hidden="true" />
          </span>
          <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-foreground">
            Room access verification required
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Staff portals open only after today&apos;s Daily Access Code has verified your registered hospital email.
            Verify your identity first, then return to the {portal.label ?? "staff"} login form.
          </p>

          <Link
            to="/room"
            className="mt-6 inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/80 focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            Verify your hospital identity <ArrowRight size={16} aria-hidden="true" />
          </Link>

          <p className="mt-5 text-xs leading-relaxed text-muted-foreground">
            Are you a patient or administrator?{" "}
            <Link to="/login?role=patient" className="font-semibold text-foreground underline underline-offset-4">
              Patient login
            </Link>{" "}
            and{" "}
            <Link
              to="/login?role=administration"
              className="font-semibold text-foreground underline underline-offset-4"
            >
              administrator login
            </Link>{" "}
            do not use the Daily Access Code.
          </p>

          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
            Already accepted a staff invitation but still need to verify your email or finish your profile?{" "}
            <Link to="/login" className="font-semibold text-foreground underline underline-offset-4">
              Sign in to continue activation
            </Link>
            . The dashboard stays closed until both steps are complete.
          </p>
        </main>
      </div>
    );
  }

  const forgotPasswordHref = portal.slug
    ? `/login?role=${portal.slug}#forgot-password`
    : "#forgot-password";

  return (
    <div className="flex min-h-screen flex-col bg-background lg:flex-row">
      {/* Brand / portal panel */}
      <aside
        aria-hidden="true"
        className="relative overflow-hidden border-b border-border bg-card px-5 py-6 lg:w-[42%] lg:border-b-0 lg:border-r lg:px-10 lg:py-10"
      >
        <div
          className="pointer-events-none absolute -right-16 -top-16 size-52 rounded-full opacity-20 blur-2xl lg:size-72"
          style={{ backgroundColor: portal.color }}
        />
        <div className="relative flex h-full flex-col gap-6">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 self-start rounded-lg text-sm font-semibold text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
            tabIndex={-1}
          >
            <ArrowLeft size={15} />
            Back to home
          </Link>

          <div className="hidden flex-1 flex-col justify-center lg:flex">
            <span
              className="flex size-12 items-center justify-center rounded-2xl"
              style={{ backgroundColor: `${portal.color}1f`, color: portal.color }}
            >
              <Icon size={24} />
            </span>
            <p className="mt-5 text-2xl font-extrabold leading-snug text-foreground">
              {portal.label ? `Welcome to the ${portal.label}` : "Welcome to HOS"}
            </p>
            <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
              {portal.description}
            </p>
          </div>
        </div>
      </aside>

      {/* Form */}
      <main className="flex flex-1 items-start justify-center px-4 py-8 sm:px-6 sm:py-12 lg:items-center">
        <div className="w-full max-w-sm">
          <div className="mb-6 flex items-center gap-3 lg:hidden">
            <span
              className="flex size-10 items-center justify-center rounded-xl"
              style={{ backgroundColor: `${portal.color}1f`, color: portal.color }}
            >
              <Icon size={20} aria-hidden="true" />
            </span>
            <span className="text-sm font-semibold text-muted-foreground">
              {portal.label ?? "Hospital Management System"}
            </span>
          </div>

          <h1 className="text-2xl font-extrabold tracking-tight text-foreground">{heading}</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {portal.description}
          </p>

          {roomRole && (
            <p className="mt-4 flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">
              <ShieldCheck size={14} aria-hidden="true" /> Room access verified for this session
            </p>
          )}

          <form onSubmit={onSubmit} noValidate className="mt-7 flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <Label htmlFor="login-email">Email address</Label>
              <div className="relative">
                <Mail
                  size={16}
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  id="login-email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="you@hospital.org"
                  className="h-10 pl-9"
                  aria-invalid={errors.email ? true : undefined}
                  aria-describedby={errors.email ? "login-email-error" : undefined}
                  {...register("email", {
                    required: "Enter your email address.",
                    pattern: { value: EMAIL_PATTERN, message: "Enter a valid email address." },
                  })}
                />
              </div>
              {errors.email && (
                <p id="login-email-error" role="alert" className="text-xs font-medium text-destructive">
                  {errors.email.message}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-baseline justify-between gap-3">
                <Label htmlFor="login-password">Password</Label>
                <a
                  href={forgotPasswordHref}
                  className="rounded text-xs font-semibold text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  Forgot password?
                </a>
              </div>
              <div className="relative">
                <Lock
                  size={16}
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  className="h-10 pl-9 pr-11"
                  aria-invalid={errors.password ? true : undefined}
                  aria-describedby={errors.password ? "login-password-error" : undefined}
                  {...register("password", {
                    required: "Enter your password.",
                    minLength: { value: 8, message: "Password must be at least 8 characters." },
                  })}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((visible) => !visible)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                  aria-controls="login-password"
                  className="absolute right-1 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  {showPassword ? (
                    <EyeOff size={16} aria-hidden="true" />
                  ) : (
                    <Eye size={16} aria-hidden="true" />
                  )}
                </button>
              </div>
              {errors.password && (
                <p id="login-password-error" role="alert" className="text-xs font-medium text-destructive">
                  {errors.password.message}
                </p>
              )}
            </div>

            {authError && (
              <p role="alert" className="text-xs font-medium text-destructive">
                {authError}{" "}
                {isStaffPortal && !roomRole && (
                  <Link to="/room" className="font-bold underline underline-offset-4">
                    Verify Room Access
                  </Link>
                )}
              </p>
            )}

            <Button
              type="submit"
              disabled={isSubmitting || signIn.isPending}
              className="mt-1 h-10 w-full rounded-xl text-sm font-bold"
            >
              {isSubmitting || signIn.isPending ? "Signing in…" : "Sign in"}
            </Button>
          </form>

          <div className="mt-6 flex flex-col gap-2 text-xs leading-relaxed text-muted-foreground">
            {!isStaffPortal && (
              <p>
                Hospital staff?{" "}
                <Link to="/room" className="font-semibold text-foreground underline underline-offset-4">
                  Verify your identity and use your staff portal
                </Link>
                .
              </p>
            )}
            <p>
              New patient?{" "}
              <Link
                to="/register"
                className="font-semibold text-foreground underline underline-offset-4 outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Create a patient account
              </Link>
              .
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
