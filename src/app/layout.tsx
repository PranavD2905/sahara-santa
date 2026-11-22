import type { Metadata, Viewport } from "next";
import { Jost, Oswald } from "next/font/google";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { LiveUpdates } from "@/components/live-updates";
import { BackgroundMusic } from "@/components/background-music";
import { SignOutButton } from "@/components/sign-out-button";
import { Avatar } from "@/components/ui";
import { getSession } from "@/lib/auth";
import "./globals.css";

// Same faces as the tarot Reveal: Oswald for titles, Jost for body text.
const oswald = Oswald({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-oswald" });
const jost = Jost({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-jost" });

export const metadata: Metadata = {
  title: "Sahara Santa",
  description: "Secret Santa for your friend group, under the desert stars.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0f1640",
};

/** Reads the session, so it streams in behind Suspense (Cache Components). */
async function NavUser() {
  const session = await getSession();
  return session ? (
    <div className="flex items-center gap-2 sm:gap-4">
      <LiveUpdates />
      <Link
        href="/profile"
        className="flex items-center gap-2 rounded-full py-1 pr-3 pl-1 text-sm text-cream/90 hover:bg-cream/10"
        title="Your profile"
      >
        <Avatar name={session.user.name} image={session.user.image ?? null} size={28} />
        <span className="hidden max-w-40 truncate sm:inline">{session.user.name}</span>
      </Link>
      <SignOutButton />
    </div>
  ) : (
    <Link href="/sign-in" className="text-sm text-cream/90 underline-offset-4 hover:underline">
      Sign in
    </Link>
  );
}

// Explicit type, not Next's generated `LayoutProps`: those globals only exist
// after `next dev`/`next build`, so a fresh CI checkout can't typecheck them.
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${oswald.variable} ${jost.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <div className="sky-backdrop" aria-hidden="true" />
        <header className="border-b border-sand-lt/15 bg-night/60 backdrop-blur-sm">
          <nav className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
            <Link href="/" className="brand-plaque" aria-label="Sahara Santa home">
              Sahara Santa
            </Link>
            <Suspense fallback={<span className="text-sm text-cream/50">…</span>}>
              <NavUser />
            </Suspense>
          </nav>
        </header>
        <Suspense
          fallback={<main className="mx-auto w-full max-w-6xl px-4 py-10 text-cream/60">Loading…</main>}
        >
          {children}
        </Suspense>
        <BackgroundMusic />
      </body>
    </html>
  );
}
