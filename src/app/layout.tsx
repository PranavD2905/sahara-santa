import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { SignOutButton } from "@/components/sign-out-button";
import { getSession } from "@/lib/auth";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Sahara Santa",
  description: "Secret Santa for your friends, family, and office.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

/** Reads the session, so it streams in behind Suspense (Cache Components). */
async function NavUser() {
  const session = await getSession();
  return session ? (
    <div className="flex items-center gap-4">
      <Link href="/profile" className="text-sm underline">
        {session.user.name}
      </Link>
      <SignOutButton />
    </div>
  ) : (
    <Link href="/sign-in" className="text-sm underline">
      Sign in
    </Link>
  );
}

// Explicit type, not Next's generated `LayoutProps`: those globals only exist
// after `next dev`/`next build`, so a fresh CI checkout can't typecheck them.
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <header className="border-b border-neutral-200 dark:border-neutral-800">
          <nav className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3">
            <Link href="/" className="font-semibold">
              Sahara Santa
            </Link>
            <Suspense fallback={<span className="text-sm text-neutral-400">…</span>}>
              <NavUser />
            </Suspense>
          </nav>
        </header>
        <Suspense fallback={<main className="mx-auto w-full max-w-6xl px-4 py-8 text-neutral-400">Loading…</main>}>
          {children}
        </Suspense>
      </body>
    </html>
  );
}
