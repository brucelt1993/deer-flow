"use client";

import {
  KeyRoundIcon,
  LockKeyholeIcon,
  MailIcon,
  ShieldCheckIcon,
  SparklesIcon,
  UserCogIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import {
  AuthErrorBanner,
  AuthField,
  AuthInput,
  AuthLoadingScreen,
  AuthPasswordInput,
  AuthShell,
} from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { getCsrfHeaders } from "@/core/api/fetcher";
import { useAuth } from "@/core/auth/AuthProvider";
import { parseAuthError } from "@/core/auth/types";

type SetupMode = "loading" | "init_admin" | "change_password";

export default function SetupPage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();
  const [mode, setMode] = useState<SetupMode>("loading");

  const [email, setEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [enteringWorkspace, setEnteringWorkspace] = useState(false);

  useEffect(() => {
    let cancelled = false;

    if (isAuthenticated && user?.needs_setup) {
      setMode("change_password");
      setEmail(user.email ?? "");
    } else if (!isAuthenticated) {
      void fetch("/api/v1/auth/setup-status")
        .then((r) => r.json())
        .then((data: { needs_setup?: boolean }) => {
          if (cancelled) return;
          if (data.needs_setup) {
            setMode("init_admin");
          } else {
            router.push("/login");
          }
        })
        .catch(() => {
          if (!cancelled) router.push("/login");
        });
    } else {
      router.push("/workspace");
    }

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, router, user]);

  const highlights = useMemo(
    () => [
      {
        icon: ShieldCheckIcon,
        title: "Gateway Controlled",
        description:
          "Admin bootstrap and credential updates stay inside the same gateway auth contract used elsewhere.",
      },
      {
        icon: UserCogIcon,
        title: "One Clean Entry",
        description:
          "Initialization and forced credential updates share one consistent product surface instead of standalone forms.",
      },
      {
        icon: SparklesIcon,
        title: "Ready For Workspace",
        description:
          "Once setup is complete you land straight in Aether, without an extra migration or onboarding detour.",
      },
    ],
    [],
  );

  const panelCopy =
    mode === "init_admin"
      ? {
          panelTag: "Administrator Bootstrap",
          panelTitle: "Create the first admin account",
          panelDescription:
            "This workspace has not been initialized yet. Create the administrator account that will own the first authenticated session.",
          submitLabel: "Create Admin Account",
          loadingLabel: "Creating Admin Account...",
        }
      : {
          panelTag: "Credential Update",
          panelTitle: "Complete your account setup",
          panelDescription:
            "Replace the temporary credentials with your real email and a strong password before entering the workspace.",
          submitLabel: "Complete Setup",
          loadingLabel: "Completing Setup...",
        };
  const isBusy = loading || enteringWorkspace;

  const handleInitAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isBusy) {
      return;
    }
    setError("");

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    let shouldReleaseLoading = true;
    try {
      const res = await fetch("/api/v1/auth/initialize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          email,
          password: newPassword,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        const authError = parseAuthError(data);
        setError(authError.message);
        return;
      }

      shouldReleaseLoading = false;
      setEnteringWorkspace(true);
      router.push("/workspace");
    } catch {
      setEnteringWorkspace(false);
      setError("Network error. Please try again.");
    } finally {
      if (shouldReleaseLoading) {
        setLoading(false);
      }
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isBusy) {
      return;
    }
    setError("");

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setLoading(true);
    let shouldReleaseLoading = true;
    try {
      const res = await fetch("/api/v1/auth/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getCsrfHeaders(),
        },
        credentials: "include",
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
          new_email: email || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        const authError = parseAuthError(data);
        setError(authError.message);
        return;
      }

      shouldReleaseLoading = false;
      setEnteringWorkspace(true);
      router.push("/workspace");
    } catch {
      setEnteringWorkspace(false);
      setError("Network error. Please try again.");
    } finally {
      if (shouldReleaseLoading) {
        setLoading(false);
      }
    }
  };

  if (mode === "loading") {
    return (
      <AuthLoadingScreen
        title="Preparing secure entry"
        description="Checking whether this workspace needs admin bootstrap or a credential refresh."
      />
    );
  }

  return (
    <AuthShell
      panelTag={panelCopy.panelTag}
      panelTitle={panelCopy.panelTitle}
      panelDescription={panelCopy.panelDescription}
      heroTitle="Set the authentication baseline once, then let the workspace take over."
      heroDescription="Aether should feel coherent even during setup. This flow handles first admin creation and required credential refreshes without dropping back into legacy-looking forms."
      highlights={highlights}
      footer={
        <div className="border-t border-white/10 pt-5 text-xs leading-6 text-white/34">
          {mode === "init_admin"
            ? "This step is only available before the first administrator exists."
            : "After this update the previous temporary credentials are invalidated automatically."}
        </div>
      }
    >
      <form
        onSubmit={mode === "init_admin" ? handleInitAdmin : handleChangePassword}
        className="space-y-5"
      >
        <AuthField htmlFor="email" label="Email Address" icon={MailIcon}>
          <AuthInput
            id="email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            disabled={isBusy}
            required
          />
        </AuthField>

        {mode === "change_password" && (
          <AuthField
            htmlFor="currentPassword"
            label="Current Password"
            icon={KeyRoundIcon}
          >
            <AuthPasswordInput
              id="currentPassword"
              placeholder="Enter current password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
              disabled={isBusy}
              required
            />
          </AuthField>
        )}

        <AuthField
          htmlFor="newPassword"
          label="New Password"
          icon={LockKeyholeIcon}
          hint="min 8 chars"
        >
          <AuthPasswordInput
            id="newPassword"
            placeholder={
              mode === "init_admin"
                ? "Create an administrator password"
                : "Create a new password"
            }
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password"
            disabled={isBusy}
            required
            minLength={8}
          />
        </AuthField>

        <AuthField
          htmlFor="confirmPassword"
          label="Confirm Password"
          icon={LockKeyholeIcon}
        >
          <AuthPasswordInput
            id="confirmPassword"
            placeholder="Repeat password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
            disabled={isBusy}
            required
            minLength={8}
          />
        </AuthField>

        {error ? <AuthErrorBanner message={error} /> : null}

        <Button
          type="submit"
          size="lg"
          disabled={isBusy}
          className="h-11 w-full rounded-md bg-primary/92 text-sm font-medium text-primary-foreground shadow-[0_16px_40px_rgba(33,211,173,0.18)] hover:bg-primary"
        >
          {enteringWorkspace
            ? "Opening Workspace..."
            : loading
              ? panelCopy.loadingLabel
              : panelCopy.submitLabel}
        </Button>
      </form>
    </AuthShell>
  );
}
