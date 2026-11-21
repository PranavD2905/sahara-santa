import type { ComponentProps, ReactNode } from "react";

/** Deliberately plain building blocks; the visual theme comes after v1. */

export function Page({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-semibold">{title}</h1>
      <div className="space-y-6">{children}</div>
    </main>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-lg border border-neutral-300 p-4 dark:border-neutral-700 ${className}`}>
      {children}
    </section>
  );
}

export function Field({
  label,
  hint,
  ...input
}: ComponentProps<"input"> & { label: string; hint?: string }) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium">{label}</span>
      <input
        className="w-full rounded-md border border-neutral-300 bg-transparent px-3 py-2 text-base dark:border-neutral-700"
        {...input}
      />
      {hint && <span className="block text-xs text-neutral-500">{hint}</span>}
    </label>
  );
}

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ComponentProps<"button"> & { variant?: "primary" | "secondary" | "danger" }) {
  const styles = {
    primary: "bg-red-700 text-white hover:bg-red-800",
    secondary: "border border-neutral-300 hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800",
    danger: "bg-neutral-900 text-white hover:bg-black dark:bg-neutral-100 dark:text-black",
  }[variant];
  return (
    <button
      className={`rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50 ${styles} ${className}`}
      {...props}
    />
  );
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
    info: "bg-neutral-100 dark:bg-neutral-800",
    error: "bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200",
    success: "bg-green-100 text-green-900 dark:bg-green-950 dark:text-green-200",
  }[tone];
  return (
    <p role={tone === "error" ? "alert" : "status"} className={`rounded-md px-3 py-2 text-sm ${styles}`}>
      {children}
    </p>
  );
}

export function Avatar({ name, image, size = 40 }: { name: string; image: string | null; size?: number }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
  if (image) {
    // eslint-disable-next-line @next/next/no-img-element -- private, auth-gated images
    return <img src={image} alt="" width={size} height={size} className="rounded-full object-cover" style={{ width: size, height: size }} />;
  }
  return (
    <span
      aria-hidden
      className="inline-flex items-center justify-center rounded-full bg-red-200 font-medium text-red-900"
      style={{ width: size, height: size, fontSize: size / 2.6 }}
    >
      {initials || "?"}
    </span>
  );
}
