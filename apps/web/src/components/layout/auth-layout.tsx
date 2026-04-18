import type { ReactNode } from "react";

interface AuthLayoutProps {
  children: ReactNode;
}

export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="grid min-h-svh grid-cols-1 lg:grid-cols-2">
      {/* Left panel - hidden on mobile */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-brand p-10 lg:flex">
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-brand via-brand/90 to-brand/70" />

        {/* Subtle pattern decoration */}
        <div className="absolute -right-24 -top-24 size-96 rounded-full bg-white/[0.04]" />
        <div className="absolute -bottom-32 -left-16 size-80 rounded-full bg-white/[0.06]" />

        {/* Logo */}
        <div className="relative z-10 flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-md bg-white text-sm font-bold text-brand">
            O
          </div>
          <span className="text-lg font-bold text-white">Orys</span>
        </div>

        {/* Tagline */}
        <div className="relative z-10">
          <blockquote className="space-y-2">
            <p className="text-xl font-medium leading-relaxed text-white/90">
              Real-time auctions, transparent bidding, trusted results.
            </p>
            <p className="text-sm text-white/60">
              The modern platform for competitive bidding.
            </p>
          </blockquote>
        </div>
      </div>

      {/* Right panel - content */}
      <div className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </div>
  );
}
