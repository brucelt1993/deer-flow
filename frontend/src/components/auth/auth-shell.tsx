"use client";

import {
  AlertCircleIcon,
  ArrowRightIcon,
  EyeIcon,
  EyeOffIcon,
  Loader2Icon,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import Galaxy from "@/components/ui/galaxy";
import { FlickeringGrid } from "@/components/ui/flickering-grid";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type AuthHighlight = {
  icon: LucideIcon;
  title: string;
  description: string;
};

export function AuthShell({
  panelTag,
  panelTitle,
  panelDescription,
  heroTitle,
  heroDescription,
  highlights,
  children,
  footer,
}: {
  panelTag: string;
  panelTitle: string;
  panelDescription: string;
  heroTitle: string;
  heroDescription: string;
  highlights: AuthHighlight[];
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="dark bg-background text-foreground relative min-h-screen overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(83,229,208,0.16),transparent_30%),radial-gradient(circle_at_80%_20%,_rgba(52,211,153,0.1),transparent_24%),linear-gradient(180deg,_#091511_0%,_#050a09_52%,_#040706_100%)]" />
      <div className="absolute inset-0 opacity-70">
        <Galaxy
          mouseRepulsion={false}
          starSpeed={0.14}
          density={0.56}
          glowIntensity={0.28}
          twinkleIntensity={0.24}
          speed={0.32}
        />
      </div>
      <FlickeringGrid
        className="absolute inset-0 opacity-35 mask-[linear-gradient(135deg,transparent_8%,black_24%,black_76%,transparent_92%)]"
        squareSize={3}
        gridGap={5}
        color="white"
        maxOpacity={0.16}
        flickerChance={0.18}
      />
      <div className="pointer-events-none absolute inset-y-0 right-[-6rem] hidden w-[34rem] lg:block">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(83,229,208,0.12),transparent_60%)]" />
      </div>
      <div className="pointer-events-none absolute -bottom-18 left-[6%] hidden opacity-15 lg:block">
        <img src="/images/aether-mark.svg" alt="" className="h-80 w-auto" />
      </div>

      <div className="relative mx-auto flex min-h-screen w-full max-w-7xl items-center px-6 py-10 sm:px-8 lg:px-12">
        <div className="grid w-full items-center gap-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(24rem,30rem)] lg:gap-14">
          <section className="flex flex-col gap-8">
            <div className="inline-flex w-fit items-center gap-3 rounded-full border border-white/10 bg-white/6 px-4 py-2 backdrop-blur-xl">
              <img
                src="/images/aether-mark.svg"
                alt=""
                className="h-4 w-auto opacity-90"
              />
              <div className="text-sm font-medium text-white/92">Aether 靈境</div>
            </div>

            <div className="space-y-5">
              <p className="text-[11px] font-medium tracking-[0.32em] text-white/48 uppercase">
                Agent Workspace
              </p>
              <h1 className="max-w-3xl text-4xl leading-tight font-semibold text-white sm:text-5xl lg:text-6xl">
                {heroTitle}
              </h1>
              <p className="max-w-2xl text-base leading-7 text-white/64 sm:text-lg">
                {heroDescription}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 lg:max-w-3xl">
              {highlights.map(({ icon: Icon, title, description }) => (
                <div
                  key={title}
                  className="rounded-lg border border-white/10 bg-white/[0.05] p-4 shadow-[0_16px_50px_rgba(0,0,0,0.16)] backdrop-blur-xl"
                >
                  <div className="mb-3 flex size-9 items-center justify-center rounded-lg bg-white/8 text-primary">
                    <Icon className="size-4" />
                  </div>
                  <div className="space-y-1">
                    <h2 className="text-sm font-medium text-white">{title}</h2>
                    <p className="text-sm leading-6 text-white/54">
                      {description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="relative overflow-hidden rounded-lg border border-white/10 bg-white/[0.06] shadow-[0_30px_90px_rgba(0,0,0,0.45)] backdrop-blur-2xl">
            <div className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.34),transparent)]" />
            <div className="space-y-8 p-6 sm:p-8">
              <div className="space-y-4">
                <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-black/15 px-3 py-1 text-[11px] font-medium tracking-[0.2em] text-white/54 uppercase">
                  {panelTag}
                </div>
                <div className="space-y-2">
                  <h2 className="text-2xl font-semibold text-white sm:text-3xl">
                    {panelTitle}
                  </h2>
                  <p className="text-sm leading-6 text-white/56 sm:text-base">
                    {panelDescription}
                  </p>
                </div>
              </div>

              <div className="space-y-6">{children}</div>

              {footer && <div className="space-y-4">{footer}</div>}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

export function AuthLoadingScreen({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="dark bg-background text-foreground relative flex min-h-screen items-center justify-center overflow-hidden px-6">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(83,229,208,0.16),transparent_30%),linear-gradient(180deg,_#091511_0%,_#040706_100%)]" />
      <div className="absolute inset-0 opacity-65">
        <Galaxy
          mouseRepulsion={false}
          starSpeed={0.1}
          density={0.5}
          glowIntensity={0.24}
          twinkleIntensity={0.22}
          speed={0.24}
        />
      </div>
      <div className="relative flex flex-col items-center gap-4 text-center">
        <div className="inline-flex items-center gap-3 rounded-full border border-white/10 bg-white/6 px-4 py-2 backdrop-blur-xl">
          <img src="/images/aether-mark.svg" alt="" className="h-4 w-auto" />
          <span className="text-sm font-medium text-white/92">Aether 靈境</span>
        </div>
        <Loader2Icon className="size-6 animate-spin text-primary" />
        <div className="space-y-1">
          <p className="text-base font-medium text-white">{title}</p>
          <p className="text-sm text-white/56">{description}</p>
        </div>
      </div>
    </div>
  );
}

export function AuthField({
  htmlFor,
  label,
  icon: Icon,
  hint,
  children,
}: {
  htmlFor?: string;
  label: string;
  icon: LucideIcon;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <label
          htmlFor={htmlFor}
          className="flex items-center gap-2 text-[11px] font-medium tracking-[0.2em] text-white/56 uppercase"
        >
          <Icon className="size-3.5" />
          <span>{label}</span>
        </label>
        {hint ? <span className="text-xs text-white/38">{hint}</span> : null}
      </div>
      {children}
    </div>
  );
}

export function AuthInput(props: React.ComponentProps<typeof Input>) {
  return (
    <Input
      {...props}
      className={cn(
        "h-11 border-white/10 bg-white/[0.05] text-white shadow-none placeholder:text-white/32 focus-visible:border-primary/50 focus-visible:ring-primary/15",
        props.className,
      )}
    />
  );
}

export function AuthPasswordInput(
  props: Omit<React.ComponentProps<typeof Input>, "type">,
) {
  const { className, ...restProps } = props;
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <AuthInput
        {...restProps}
        type={visible ? "text" : "password"}
        className={cn("pr-11", className)}
      />
      <button
        type="button"
        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-white/38 transition-colors hover:text-white/72"
        onClick={() => setVisible((state) => !state)}
        aria-label={visible ? "Hide password" : "Show password"}
      >
        {visible ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
      </button>
    </div>
  );
}

export function AuthErrorBanner({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 rounded-md border border-red-400/25 bg-red-500/10 px-3 py-2 text-sm text-red-100">
      <AlertCircleIcon className="mt-0.5 size-4 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

export function AuthBackLink({
  href,
  label,
}: {
  href: string;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="group inline-flex items-center gap-2 text-sm text-white/44 transition-colors hover:text-white/74"
    >
      <span>{label}</span>
      <ArrowRightIcon className="size-3.5 transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}
