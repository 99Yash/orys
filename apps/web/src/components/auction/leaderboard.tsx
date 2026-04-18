"use client";

import { useScan } from "~/lib/replicache/hooks";
import { useRep } from "~/lib/replicache/provider";
import { cn, formatCents } from "~/lib/utils";
import { Button } from "~/components/ui/button";

type LeaderboardEntry = {
  rank: number;
  amountCents: number;
  status: string;
  userId?: string;
  quoteId?: string;
  createdAt: string;
};

const rankStyles = [
  "bg-amber-50 text-amber-700 ring-1 ring-amber-400/30",
  "bg-slate-100 text-slate-600 ring-1 ring-slate-300/40",
  "bg-orange-50 text-orange-700 ring-1 ring-orange-400/30",
];

const rankEmoji: Record<number, string> = {
  1: "\u{1F947}",
  2: "\u{1F948}",
  3: "\u{1F949}",
};

function RankBadge({ rank }: { rank: number }) {
  return (
    <span
      className={cn(
        "inline-flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold",
        rank <= 3 ? rankStyles[rank - 1] : "text-muted-foreground",
      )}
      title={`Rank #${rank}`}
    >
      {rank <= 3 ? rankEmoji[rank] : rank}
    </span>
  );
}

function bidderLabel(
  entry: LeaderboardEntry,
  isOwner: boolean,
  currentUserId: string | null | undefined,
): string {
  const isSelf = currentUserId != null && entry.userId === currentUserId;
  if (isSelf) return "You";
  if (isOwner && entry.userId) return `${entry.userId.slice(0, 8)}...`;
  return `Bidder #${entry.rank}`;
}

export function Leaderboard({
  listingId,
  canAward = false,
  isOwner = false,
  userId,
}: {
  listingId: string;
  canAward?: boolean;
  isOwner?: boolean;
  userId?: string | null;
}) {
  const rep = useRep();
  const entries = useScan<LeaderboardEntry>(
    `leaderboard/${listingId}/`,
    [listingId],
  );

  const sorted = [...entries].sort((a, b) => a.rank - b.rank);

  if (sorted.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center">
        <p className="text-sm text-muted-foreground">No bids yet</p>
        <p className="mt-1 text-xs text-muted-foreground/60">
          Be the first to place a bid
        </p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-border">
      {sorted.map((entry) => {
        const isSelf = userId != null && entry.userId === userId;
        const isWithdrawn = entry.status === "WITHDRAWN";

        return (
          <div
            key={entry.rank}
            className={cn(
              "flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0",
              isSelf && "rounded-md bg-brand/[0.03]",
              isWithdrawn && "opacity-50",
            )}
          >
            <div className="flex items-center gap-3">
              <RankBadge rank={entry.rank} />
              <div className="flex flex-col">
                <span className="text-sm text-foreground">
                  {bidderLabel(entry, isOwner, userId)}
                  {isSelf && (
                    <span className="ml-1.5 text-[10px] font-medium uppercase tracking-wider text-brand">
                      you
                    </span>
                  )}
                </span>
                {isWithdrawn && (
                  <span className="text-[11px] text-muted-foreground">
                    Withdrawn
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "font-semibold tabular-nums text-foreground",
                  isWithdrawn && "line-through",
                )}
              >
                {formatCents(entry.amountCents)}
              </span>

              {canAward && entry.quoteId && !isWithdrawn && (
                <Button
                  type="button"
                  variant="brand"
                  size="xs"
                  onClick={() =>
                    rep?.mutate.listingAward({
                      listingId,
                      quoteId: entry.quoteId!,
                    })
                  }
                >
                  Award
                </Button>
              )}

              {isSelf && !isWithdrawn && entry.quoteId && !canAward && (
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  onClick={() =>
                    rep?.mutate.quoteWithdraw({
                      listingId,
                      quoteId: entry.quoteId!,
                    })
                  }
                >
                  Withdraw
                </Button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
