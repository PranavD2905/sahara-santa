import type { ComponentProps, ReactNode } from "react";
import { BackButton } from "./back-button";

/**
 * Shared building blocks in the Sahara Santa look (see globals.css): night
 * sky pages, parchment cards framed in indigo, Oswald uppercase titles,
 * sand buttons, and the four-point sparkle from the tarot Reveal.
 */

/** The tarot Reveal's four-point sparkle. */
export function Sparkle({ className = "h-3.5 w-2.5", twinkle = false }: { className?: string; twinkle?: boolean }) {
  return (
    <svg viewBox="-5 -7 10 14" aria-hidden="true" className={`inline-block fill-current ${twinkle ? "sparkle-twinkle" : ""} ${className}`}>
      <path d="M0 -7 Q0 0 2.4 0 Q0 0 0 7 Q0 0 -2.4 0 Q0 0 0 -7Z" />
    </svg>
  );
}

/**
 * Laptop-first: dashboards use the wide layout; single-form pages pass
 * `narrow` so inputs stay a readable width on large screens.
 * Every screen gets a Back button except the home dashboard (`back={false}`);
 * `backHref` is where it goes when there's no previous screen.
 */
export function Page({
  title,
  subtitle,
  children,
  narrow = false,
  back = true,
  backHref = "/",
}: {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  narrow?: boolean;
  back?: boolean;
  backHref?: string;
}) {
  return (
    <main className={`mx-auto w-full px-4 pt-6 pb-40 sm:px-6 lg:px-8 ${narrow ? "max-w-xl" : "max-w-6xl"}`}>
      {back && <BackButton fallback={backHref} />}
      <header className="mb-8">
        <h1 className="flex items-center gap-3 font-title text-2xl font-medium tracking-[0.14em] text-cream uppercase sm:text-3xl">
          <Sparkle className="h-5 w-3.5 shrink-0 text-sand-lt" twinkle />
          <span className="min-w-0 break-words">{title}</span>
        </h1>
        {subtitle && <p className="mt-2 max-w-2xl text-cream/75">{subtitle}</p>}
      </header>
      <div className="space-y-6">{children}</div>
    </main>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`parchment p-5 sm:p-6 ${className}`}>{children}</section>;
}

/** Small uppercase heading inside a Card, like the Reveal panel's "About …". */
export function CardTitle({ children, hint }: { children: ReactNode; hint?: ReactNode }) {
  return (
    <div className="mb-4">
      <h2 className="font-title text-sm font-medium tracking-[0.24em] text-ink-soft uppercase">{children}</h2>
      {hint && <p className="mt-1 text-sm text-muted">{hint}</p>}
    </div>
  );
}

export function Field({
  label,
  hint,
  ...input
}: ComponentProps<"input"> & { label: string; hint?: string }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium text-ink">{label}</span>
      <input className="field-input" {...input} />
      {hint && <span className="block text-xs text-muted">{hint}</span>}
    </label>
  );
}

export function Select({ label, children, ...select }: ComponentProps<"select"> & { label?: string }) {
  const control = (
    <select className="field-input" {...select}>
      {children}
    </select>
  );
  if (!label) return control;
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium text-ink">{label}</span>
      {control}
    </label>
  );
}

export function TextArea({
  label,
  hint,
  ...textarea
}: ComponentProps<"textarea"> & { label: string; hint?: string }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium text-ink">{label}</span>
      <textarea className="field-input" {...textarea} />
      {hint && <span className="block text-xs text-muted">{hint}</span>}
    </label>
  );
}

type Variant = "primary" | "secondary" | "danger" | "ghost";

/**
 * Button look, also for <Link>s that act as buttons. `onNight` styles a
 * secondary/ghost button for the dark page instead of a parchment card.
 */
export function buttonClass(variant: Variant = "primary", { onNight = false, size = "md" }: { onNight?: boolean; size?: "sm" | "md" | "lg" } = {}) {
  const sizes = {
    sm: "px-3 py-1.5 text-[11px]",
    md: "px-4 py-2.5 text-xs",
    lg: "px-6 py-3.5 text-sm",
  }[size];
  const styles = {
    primary:
      "bg-sand text-ink border-2 border-ink shadow-[inset_0_0_0_2px_var(--sand),inset_0_0_0_3px_rgba(47,36,112,0.45)] hover:bg-sand-lt",
    secondary: onNight
      ? "border border-sand-lt/60 text-cream hover:bg-cream/10"
      : "border-[1.5px] border-ink/60 text-ink hover:bg-ink/5",
    danger: "bg-berry text-cream border-2 border-berry hover:brightness-110",
    ghost: onNight ? "text-cream/80 hover:text-cream hover:bg-cream/10" : "text-ink hover:bg-ink/5",
  }[variant];
  return `inline-flex items-center justify-center gap-2 rounded-md font-title font-medium tracking-[0.16em] uppercase transition disabled:cursor-not-allowed disabled:opacity-50 ${sizes} ${styles}`;
}

export function Button({
  variant = "primary",
  size = "md",
  onNight = false,
  className = "",
  ...props
}: ComponentProps<"button"> & { variant?: Variant; size?: "sm" | "md" | "lg"; onNight?: boolean }) {
  return <button className={`${buttonClass(variant, { onNight, size })} ${className}`} {...props} />;
}

export function Notice({
  tone = "info",
  children,
}: {
  tone?: "info" | "error" | "success";
  children: ReactNode;
}) {
  if (!children) return null;
  const styles = {
    info: "border-ink/25 bg-paper text-ink",
    error: "border-berry/50 bg-[#f8dcd8] text-[#6b1222]",
    success: "border-pine/40 bg-[#dcefe1] text-[#1d4a35]",
  }[tone];
  return (
    <p role={tone === "error" ? "alert" : "status"} className={`rounded-md border px-3 py-2 text-sm ${styles}`}>
      {children}
    </p>
  );
}

/** Notice shown directly on the night background (outside a Card). */
export function Banner({ children, tone = "info" }: { children: ReactNode; tone?: "info" | "error" }) {
  if (!children) return null;
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={`flex items-start gap-2 rounded-md border px-4 py-3 text-sm ${
        tone === "error" ? "border-berry/60 bg-berry/25 text-cream" : "border-sand-lt/30 bg-cream/10 text-cream"
      }`}
    >
      <Sparkle className="mt-0.5 h-3.5 w-2.5 shrink-0 text-sand-lt" />
      <span>{children}</span>
    </p>
  );
}

/** Status pill, e.g. "Joining open". */
export function Pill({ children, tone = "sand" }: { children: ReactNode; tone?: "sand" | "ink" | "pine" | "muted" }) {
  const styles = {
    sand: "bg-sand text-ink",
    ink: "bg-ink text-cream",
    pine: "bg-pine text-cream",
    muted: "bg-ink/10 text-ink",
  }[tone];
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 font-title text-[10px] font-medium tracking-[0.16em] uppercase ${styles}`}>
      {children}
    </span>
  );
}

/** Round picture framed like the tarot card photo (indigo + sand rings). */
export function Avatar({ name, image, size = 40 }: { name: string; image: string | null; size?: number }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
  const ring = Math.max(1.5, size * 0.035);
  const frame = {
    width: size,
    height: size,
    boxShadow: `0 0 0 ${ring}px var(--ink), 0 0 0 ${ring * 2}px var(--sand), 0 0 0 ${ring * 2.6}px var(--ink)`,
  };
  if (image) {
    // eslint-disable-next-line @next/next/no-img-element -- private, auth-gated images
    return <img src={image} alt="" width={size} height={size} className="shrink-0 rounded-full object-cover" style={frame} />;
  }
  return (
    <span
      aria-hidden
      className="inline-flex shrink-0 items-center justify-center rounded-full font-title font-medium tracking-[0.06em] text-sand-lt"
      style={{ ...frame, fontSize: size / 2.6, background: "radial-gradient(circle at 40% 35%, #8b7274, #4a3a6a)" }}
    >
      {initials || "?"}
    </span>
  );
}
