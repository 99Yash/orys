"use client";

import { cn } from "~/lib/utils";

const statusConfig: Record<
  string,
  { label: string; dot?: boolean; className: string }
> = {
  DRAFT: {
    label: "Draft",
    className: "bg-foreground/[0.06] text-muted-foreground",
  },
  LIVE: {
    label: "Live",
    dot: true,
    className: "bg-emerald-500/10 text-emerald-700",
  },
  ENDED: {
    label: "Ended",
    className: "bg-foreground/[0.06] text-muted-foreground",
  },
  AWARDED: {
    label: "Awarded",
    className: "bg-brand/10 text-brand",
  },
};

interface ListingStatusBadgeProps {
  status: string;
  className?: string;
}

export function ListingStatusBadge({
  status,
  className,
}: ListingStatusBadgeProps) {
  const config = statusConfig[status] ?? statusConfig.DRAFT!;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold",
        config.className,
        className,
      )}
    >
      {config.dot && (
        <span className="relative flex size-1.5">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-75" />
          <span className="relative inline-flex size-1.5 rounded-full bg-emerald-500" />
        </span>
      )}
      {config.label}
    </span>
  );
}
