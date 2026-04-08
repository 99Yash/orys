"use client";

import { useState } from "react";
import { useRep } from "../../lib/replicache/provider";
import { cn } from "../../lib/utils";

export function BidForm({
  listingId,
  currentBestCents,
  minStepCents,
  currency,
}: {
  listingId: string;
  currentBestCents: number;
  minStepCents: number;
  currency: string;
}) {
  const rep = useRep();
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");

  const minBid = currentBestCents + minStepCents;
  const minBidDisplay = (minBid / 100).toFixed(2);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!rep) return;

    const amountCents = Math.round(Number.parseFloat(amount) * 100);
    if (Number.isNaN(amountCents) || amountCents <= 0) {
      setError("Enter a valid amount");
      return;
    }
    if (amountCents < minBid) {
      setError(`Minimum bid is $${minBidDisplay}`);
      return;
    }

    setError("");
    await rep.mutate.quoteUpsert({
      listingId,
      quoteId: crypto.randomUUID(),
      amountCents,
    });
    setAmount("");
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <label className="text-sm font-medium text-foreground">
        Place your bid
      </label>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
            $
          </span>
          <input
            type="number"
            step="0.01"
            min={minBid / 100}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={minBidDisplay}
            className={cn(
              "w-full rounded-lg border border-border bg-background py-2.5 pl-7 pr-3 text-sm tabular-nums",
              "transition-colors placeholder:text-muted-foreground/60",
              "focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20",
              error &&
                "border-destructive focus:border-destructive focus:ring-destructive/20",
            )}
          />
        </div>
        <button
          type="submit"
          className="rounded-lg bg-brand px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand/90 active:bg-brand/80"
        >
          Bid
        </button>
      </div>
      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : (
        <p className="text-xs text-muted-foreground">
          Minimum: ${minBidDisplay} {currency}
        </p>
      )}
    </form>
  );
}
