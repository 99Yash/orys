"use client";

import Link from "next/link";
import { cn, formatCents } from "~/lib/utils";
import { Countdown } from "./countdown";
import { Skeleton } from "~/components/ui/skeleton";
import type { CardDoc } from "~/lib/auction/managers";

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

function cardAccent(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = id.charCodeAt(i) + ((h << 5) - h);
  const hue = Math.abs(h) % 360;
  return `linear-gradient(135deg, hsl(${hue} 35% 94%) 0%, hsl(${(hue + 45) % 360} 30% 91%) 100%)`;
}

function ListingCardSkeleton() {
  return (
    <div className="flex size-full flex-col overflow-hidden rounded-xl border border-border/80 bg-background">
      <Skeleton className="aspect-[16/9] rounded-none" />
      <div className="flex flex-1 flex-col justify-between gap-3 p-4">
        <div className="space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
        <div className="flex items-end justify-between gap-2">
          <div className="space-y-1">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-6 w-24" />
          </div>
          <Skeleton className="h-4 w-12" />
        </div>
      </div>
    </div>
  );
}

function ListingCardComponent({
  card,
  userId,
}: {
  card: CardDoc;
  userId?: string | null;
}) {
  const isActive = card.status === "LIVE";
  const status = statusConfig[card.status] ?? statusConfig.DRAFT!;
  const hasBids = card.bestAmountCents > 0;
  const isOwner = userId != null && card.ownerId === userId;

  return (
    <Link
      href={`/listing/${card.id}` as never}
      aria-label={card.title}
      className={cn(
        "group flex size-full flex-col overflow-hidden rounded-xl border border-border/80 bg-background",
        "transition-all duration-200 ease-out",
        "hover:-translate-y-0.5 hover:border-border hover:shadow-lg hover:shadow-foreground/[0.04]",
      )}
    >
      {/* Accent area */}
      <div
        className="relative aspect-[16/9] overflow-hidden"
        style={{ background: cardAccent(card.id) }}
      >
        {/* Decorative initial */}
        <span className="pointer-events-none absolute bottom-2 right-4 select-none text-7xl font-bold leading-none text-foreground/[0.03]">
          {card.title.charAt(0).toUpperCase()}
        </span>

        {/* Top row: status + owner badge */}
        <div className="absolute left-3 right-3 top-3 flex items-center justify-between">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium",
              status.className,
            )}
          >
            {status.dot && (
              <span className="relative flex size-1.5">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-75" />
                <span className="relative inline-flex size-1.5 rounded-full bg-emerald-500" />
              </span>
            )}
            {status.label}
          </span>

          {isOwner && (
            <span className="inline-flex items-center rounded-full bg-brand/10 px-2 py-0.5 text-[11px] font-medium text-brand">
              Your Listing
            </span>
          )}
        </div>

        {/* Countdown chip */}
        {isActive && (
          <div className="absolute bottom-3 left-3">
            <span className="inline-flex items-center rounded-md bg-background/80 px-2 py-1 text-xs font-medium text-foreground backdrop-blur-sm">
              <Countdown endsAt={card.endsAt} variant="compact" />
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col justify-between gap-3 p-4">
        <h3 className="line-clamp-2 text-[15px] font-medium leading-snug tracking-tight text-foreground">
          {card.title}
        </h3>

        <div className="flex items-end justify-between gap-2">
          <div>
            {hasBids ? (
              <>
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  {isActive
                    ? "Current bid"
                    : card.status === "AWARDED"
                      ? "Winning bid"
                      : "Final bid"}
                </p>
                <p className="text-lg font-semibold tracking-tight tabular-nums text-foreground">
                  {formatCents(card.bestAmountCents, card.currency)}
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No bids yet</p>
            )}
          </div>
          <p className="pb-0.5 text-xs tabular-nums text-muted-foreground">
            {card.quoteCount} {card.quoteCount === 1 ? "bid" : "bids"}
          </p>
        </div>
      </div>
    </Link>
  );
}

export const ListingCard = Object.assign(ListingCardComponent, {
  Skeleton: ListingCardSkeleton,
});
