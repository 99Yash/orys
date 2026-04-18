"use client";

import { cn } from "~/lib/utils";

const STEPS = ["DRAFT", "LIVE", "ENDED", "AWARDED"] as const;

const stepLabels: Record<string, string> = {
  DRAFT: "Draft",
  LIVE: "Live",
  ENDED: "Ended",
  AWARDED: "Awarded",
};

interface ListingStatusBarProps {
  currentStatus: string;
  className?: string;
}

export function ListingStatusBar({
  currentStatus,
  className,
}: ListingStatusBarProps) {
  const currentIndex = STEPS.indexOf(
    currentStatus as (typeof STEPS)[number],
  );

  return (
    <div className={cn("flex items-stretch", className)}>
      {STEPS.map((step, i) => {
        const isActive = i <= currentIndex;
        const isLast = i === STEPS.length - 1;

        return (
          <div key={step} className="flex items-stretch">
            {/* Step pill */}
            <div
              className={cn(
                "relative flex items-center px-4 py-1.5 text-xs font-medium",
                isActive
                  ? "bg-brand text-white"
                  : "bg-muted text-muted-foreground",
                i === 0 && "rounded-l-md",
                isLast && "rounded-r-md",
              )}
            >
              {stepLabels[step]}
            </div>

            {/* Arrow separator */}
            {!isLast && (
              <div className="relative flex w-2 items-center">
                {/* Triangle pointing right */}
                <div
                  className={cn(
                    "absolute -left-px z-10 size-3 rotate-45 border-r border-t",
                    isActive
                      ? "border-brand/20 bg-brand"
                      : "border-border bg-muted",
                  )}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
