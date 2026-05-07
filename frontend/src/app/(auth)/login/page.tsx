"use client";

import {
  KeyRoundIcon,
  LockKeyholeIcon,
  MailIcon,
  OrbitIcon,
  ShieldCheckIcon,
  SparklesIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { type ReactNode, useEffect, useMemo, useState } from "react";

import {
  AuthErrorBanner,
  AuthField,
  AuthInput,
  AuthPasswordInput,
  AuthShell,
} from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/core/auth/AuthProvider";
import { parseAuthError } from "@/core/auth/types";

function validateNextParam(next: string | null): string | null {
  if (!next) {
    return null;
  }
  if (!next.startsWith("/")) {
    return null;
  }
  if (
    next.startsWith("//") ||
    next.startsWith("http://") ||
    next.startsWith("https://")
  ) {
    return null;
  }
  if (next.includes(":") && !next.startsWith("/")) {
    return null;
  }
  return next;
}

type AuthMode = "login" | "register";

const AUTH_MODE_COPY: Record<
  AuthMode,
  {
    panelTag: string;
    panelTitle: string;
    panelDescription: string;
    submitLabel: string;
    loadingLabel: string;
    switchHint: ReactNode;
  }
> = {
  login: {
    panelTag: "Secure Sign In",
    panelTitle: "Enter your workspace",
    panelDescription:
      "Sign in to continue with threads, tools, memories, and the runtime environment already attached to your account.",
    submitLabel: "Sign In",
    loadingLabel: "Signing In...",
    switchHint: (
      <>
        New to Aether?{" "}
        <span className="text-white transition-colors group-hover:text-primary">
          Create an account
        </span>
      </>
    ),
  },
  register: {
    panelTag: "Invitation Access",
    panelTitle: "Create your Aether account",
    panelDescription:
      "Use your invitation code to join the workspace. Registration creates a standard user account and signs you in immediately.",
    submitLabel: "Create Account",
    loadingLabel: "Creating Account...",
    switchHint: (
      <>
        Already have an account?{" "}
        <span className="text-white transition-colors group-hover:text-primary">
          Sign in
        </span>
      </>
    ),
  },
};

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated } = useAuth();

  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const nextParam = searchParams.get("next");
  const redirectPath = validateNextParam(nextParam) ?? "/workspace";

  useEffect(() => {
    if (isAuthenticated) {
      router.push(redirectPath);
    }
  }, [isAuthenticated, redirectPath, router]);

  useEffect(() => {
    let cancelled = false;

    void fetch("/api/v1/auth/setup-status")
      .then((r) => r.json())
      .then((data: { needs_setup?: boolean }) => {
        if (!cancelled && data.needs_setup) {
          router.push("/setup");
        }
      })
      .catch(() => {
        // Ignore errors; user stays on login page
      });

    return () => {
      cancelled = true;
    };
  }, [router]);

  const copy = AUTH_MODE_COPY[mode];

  const highlights = useMemo(
    () => [
      {
        icon: OrbitIcon,
        title: "Shared Runtime",
        description:
          "Keep your workspace connected to tools, sandbox execution, and artifacts across sessions.",
      },
      {
        icon: ShieldCheckIcon,
        title: "Scoped Access",
        description:
          "Authentication, invitation gating, and session cookies stay aligned with the gateway rules.",
      },
      {
        icon: SparklesIcon,
        title: "Built For Agents",
        description:
          "Enter directly into the operational workspace instead of a generic dashboard shell.",
      },
    ],
    [],
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const isLogin = mode === "login";
      const endpoint = isLogin
        ? "/api/v1/auth/login/local"
        : "/api/v1/auth/register";
      const body = isLogin
        ? `username=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`
        : JSON.stringify({ email, password, invite_code: inviteCode });

      const headers: HeadersInit = isLogin
        ? { "Content-Type": "application/x-www-form-urlencoded" }
        : { "Content-Type": "application/json" };

      const res = await fetch(endpoint, {
        method: "POST",
        headers,
        body,
        credentials: "include",
      });

      if (!res.ok) {
        const data = await res.json();
        const authError = parseAuthError(data);
        setError(authError.message);
        return;
      }

      router.push(redirectPath);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      panelTag={copy.panelTag}
      panelTitle={copy.panelTitle}
      panelDescription={copy.panelDescription}
      heroTitle="Aether 靈境 keeps your agent workspace ready before the first message."
      heroDescription="This entry point should feel like part of the product, not an afterthought. Sign in, redeem an invite, and move straight into the operational workspace."
      highlights={highlights}
      footer={
        <div className="flex flex-col gap-4 border-t border-white/10 pt-5">
          <button
            type="button"
            className="group text-left text-sm text-white/52 transition-colors hover:text-white"
            onClick={() => {
              setMode((current) => (current === "login" ? "register" : "login"));
              setError("");
              setInviteCode("");
            }}
          >
            {copy.switchHint}
          </button>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs leading-6 text-white/34">
              Invitation code is required for new account creation.
            </p>
            <Link
              href="/zh/docs"
              className="text-sm text-white/44 transition-colors hover:text-white/74"
            >
              Documentation
            </Link>
          </div>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <AuthField htmlFor="email" label="Email Address" icon={MailIcon}>
          <AuthInput
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            required
          />
        </AuthField>

        <AuthField
          htmlFor="password"
          label="Password"
          icon={LockKeyholeIcon}
          hint={mode === "login" ? "min 6 chars" : "min 8 chars"}
        >
          <AuthPasswordInput
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={
              mode === "login"
                ? "Enter your password"
                : "Create a strong password"
            }
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            required
            minLength={mode === "login" ? 6 : 8}
          />
        </AuthField>

        {mode === "register" && (
          <AuthField
            htmlFor="inviteCode"
            label="Invitation Code"
            icon={KeyRoundIcon}
            hint="required"
          >
            <AuthInput
              id="inviteCode"
              type="text"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              placeholder="Enter invitation code"
              autoComplete="one-time-code"
              required
            />
          </AuthField>
        )}

        {error ? <AuthErrorBanner message={error} /> : null}

        <Button
          type="submit"
          size="lg"
          disabled={loading}
          className="h-11 w-full rounded-md bg-primary/92 text-sm font-medium text-primary-foreground shadow-[0_16px_40px_rgba(33,211,173,0.18)] hover:bg-primary"
        >
          {loading ? copy.loadingLabel : copy.submitLabel}
        </Button>

        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-white/36">
          <span>
            {mode === "login"
              ? "Session cookies keep you signed in across the workspace."
              : "Your invitation code is checked by the gateway before account creation."}
          </span>
          {mode === "login" ? (
            <Link
              href="/setup"
              className="text-white/54 transition-colors hover:text-white"
            >
              First-time setup
            </Link>
          ) : null}
        </div>
      </form>
    </AuthShell>
  );
}
