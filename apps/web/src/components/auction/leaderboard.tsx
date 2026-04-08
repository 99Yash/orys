"use client";

import { useScan } from "../../lib/replicache/hooks";
import { useRep } from "../../lib/replicache/provider";
import { cn, formatCents } from "../../lib/utils";

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

function RankBadge({ rank }: { rank: number }) {
  return (
    <span
      className={cn(
        "inline-flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold",
        rank <= 3 ? rankStyles[rank - 1] : "text-muted-foreground",
      )}
    >
      {rank}
    </span>
  );
}

export function Leaderboard({
  listingId,
  canAward = false,
}: {
  listingId: string;
  canAward?: boolean;
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
      </div>
    );
  }

  return (
    <div className="divide-y divide-border">
      {sorted.map((entry) => (
        <div
          key={entry.rank}
          className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
        >
          <div className="flex items-center gap-3">
            <RankBadge rank={entry.rank} />
            <span className="text-sm text-foreground">
              {entry.userId
                ? `${entry.userId.slice(0, 8)}...`
                : `Bidder #${entry.rank}`}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-semibold tabular-nums text-foreground">
              {formatCents(entry.amountCents)}
            </span>
            {canAward && entry.quoteId && (
              <button
                type="button"
                onClick={() =>
                  rep?.mutate.listingAward({
                    listingId,
                    quoteId: entry.quoteId!,
                  })
                }
                className="rounded-md bg-brand px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-brand/90"
              >
                Award
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
