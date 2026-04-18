"use client";

import { use, useEffect } from "react";
import Link from "next/link";
import { authClient } from "../../../lib/auth-client";
import { ReplicacheProvider, useRep } from "../../../lib/replicache/provider";
import { useSubscribe } from "../../../lib/replicache/hooks";
import { Countdown } from "../../../components/auction/countdown";
import { BidForm } from "../../../components/auction/bid-form";
import { Leaderboard } from "../../../components/auction/leaderboard";
import { PresenceCount } from "../../../components/auction/presence";
import { ListingStatusBadge } from "~/components/auction/listing-status-badge";
import { ListingStatusBar } from "~/components/auction/listing-status-bar";
import { DetailsAccordion } from "~/components/auction/details-accordion";
import { Header } from "../../../components/layout/header";
import { Footer } from "../../../components/layout/footer";
import { Button } from "~/components/ui/button";
import { Separator } from "~/components/ui/separator";
import { formatCents } from "../../../lib/utils";
import * as ws from "../../../lib/realtime/socket";

type ListingDoc = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  bestAmountCents: number;
  quoteCount: number;
  endsAt: string;
  minStepCents: number;
  currency: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
};

type MyQuoteDoc = {
  quoteId: string;
  listingId: string;
  amountCents: number;
  status: string;
};

function LoadingSkeleton() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6 h-4 w-32 animate-pulse rounded bg-muted" />
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-5">
        <div className="space-y-4 lg:col-span-3">
          <div className="h-5 w-16 animate-pulse rounded-full bg-muted" />
          <div className="h-9 w-3/4 animate-pulse rounded bg-muted" />
          <div className="h-4 w-full animate-pulse rounded bg-muted" />
          <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
        </div>
        <div className="lg:col-span-2">
          <div className="space-y-4 rounded-xl border border-border p-5">
            <div className="h-3 w-16 animate-pulse rounded bg-muted" />
            <div className="h-9 w-32 animate-pulse rounded bg-muted" />
            <div className="h-3 w-20 animate-pulse rounded bg-muted" />
          </div>
        </div>
      </div>
    </main>
  );
}

function ListingDetail({
  listingId,
  userId,
}: {
  listingId: string;
  userId: string | null;
}) {
  const rep = useRep();

  const listing = useSubscribe<ListingDoc | null>(
    async (tx) => (await tx.get(`listing/${listingId}`)) as ListingDoc | null,
    null,
    [listingId],
  );

  const myQuote = useSubscribe<MyQuoteDoc | null>(
    async (tx) =>
      userId
        ? ((await tx.get(`my-quote/${listingId}`)) as MyQuoteDoc | null)
        : null,
    null,
    [listingId, userId],
  );

  useEffect(() => {
    ws.subscribeChannel(`poke:listing:${listingId}`);
    if (userId) ws.subscribeChannel(`poke:user:${userId}`);
  }, [listingId, userId]);

  if (!listing) return <LoadingSkeleton />;

  const isOwner = userId !== null && listing.ownerId === userId;
  const isLive = listing.status === "LIVE";
  const isEnded = listing.status === "ENDED";
  const isAuthed = userId !== null;

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      {/* Breadcrumb */}
      <Link
        href="/"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        &larr; Back to auctions
      </Link>

      {/* Status bar */}
      <div className="mb-6">
        <ListingStatusBar currentStatus={listing.status} />
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-5">
        {/* Main content */}
        <div className="space-y-6 lg:col-span-3">
          {/* Title section */}
          <div>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <ListingStatusBadge status={listing.status} />
              {isLive && <PresenceCount listingId={listingId} />}
            </div>

            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              {listing.title}
            </h1>

            {listing.description && (
              <p className="mt-3 leading-relaxed text-muted-foreground">
                {listing.description}
              </p>
            )}
          </div>

          <Separator />

          {/* Leaderboard */}
          <div>
            <h2 className="mb-4 text-lg font-semibold text-foreground">
              Leaderboard
            </h2>
            <Leaderboard
              listingId={listingId}
              canAward={isOwner && isEnded}
              isOwner={isOwner}
              userId={userId}
            />
          </div>

          <Separator />

          {/* Details accordion */}
          <DetailsAccordion
            listing={{
              description: listing.description,
              minStepCents: listing.minStepCents,
              currency: listing.currency,
              createdAt: listing.createdAt,
              updatedAt: listing.updatedAt,
            }}
          />
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-2">
          <div className="space-y-4 lg:sticky lg:top-24">
            {/* Bid info panel */}
            <div className="rounded-xl border border-border p-5">
              <div className="space-y-4">
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    {isLive ? "Current bid" : "Final bid"}
                  </p>
                  <p className="mt-1 text-3xl font-bold tracking-tight tabular-nums text-foreground">
                    {listing.bestAmountCents > 0
                      ? formatCents(listing.bestAmountCents, listing.currency)
                      : "No bids"}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {listing.quoteCount}{" "}
                    {listing.quoteCount === 1 ? "bid" : "bids"}
                  </p>
                </div>

                {isLive && (
                  <div className="border-t border-border pt-4">
                    <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                      Time remaining
                    </p>
                    <Countdown endsAt={listing.endsAt} variant="segmented" />
                  </div>
                )}

                {!isLive && (
                  <div className="border-t border-border pt-4">
                    <p className="text-sm text-muted-foreground">
                      {listing.status === "ENDED"
                        ? "This auction has ended"
                        : listing.status === "AWARDED"
                          ? "This auction has been awarded"
                          : `Ends ${new Date(listing.endsAt).toLocaleDateString()}`}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Bid form */}
            {isLive && isAuthed && !isOwner && (
              <div className="rounded-xl border border-border p-5">
                <BidForm
                  listingId={listingId}
                  currentBestCents={listing.bestAmountCents}
                  minStepCents={listing.minStepCents}
                  currency={listing.currency}
                />
              </div>
            )}

            {/* My bid */}
            {myQuote && myQuote.status === "ACTIVE" && (
              <div className="rounded-xl border border-brand/20 bg-brand/5 p-4">
                <p className="text-[11px] font-medium uppercase tracking-wider text-brand">
                  Your bid
                </p>
                <p className="mt-1 text-lg font-semibold tabular-nums text-foreground">
                  {formatCents(myQuote.amountCents, listing.currency)}
                </p>
              </div>
            )}

            {/* Sign in prompt */}
            {isLive && !isAuthed && (
              <div className="rounded-xl border border-border bg-muted/50 p-5 text-center">
                <p className="mb-3 text-sm text-muted-foreground">
                  Sign in to place a bid
                </p>
                <Link
                  href="/"
                  className="inline-flex rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand/90"
                >
                  Sign in
                </Link>
              </div>
            )}

            {/* Owner: end auction */}
            {isOwner && isLive && (
              <Button
                variant="destructive"
                className="w-full"
                onClick={() => rep?.mutate.listingEndNow({ listingId })}
              >
                End Auction Now
              </Button>
            )}

            {/* Owner: award prompt */}
            {isOwner && isEnded && (
              <div className="rounded-xl border border-border bg-muted/50 p-4 text-center">
                <p className="text-sm text-muted-foreground">
                  Select a winner from the leaderboard
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

export default function ListingPage({
  params,
}: {
  params: Promise<{ listingId: string }>;
}) {
  const { listingId } = use(params);
  const { data: session } = authClient.useSession();
  const userId = session?.user?.id ?? null;

  return (
    <ReplicacheProvider userId={userId}>
      <div className="relative flex min-h-screen flex-col bg-background">
        <Header />
        <ListingDetail listingId={listingId} userId={userId} />
        <Footer />
      </div>
    </ReplicacheProvider>
  );
}
