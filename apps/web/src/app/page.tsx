"use client";

import { useState, useEffect } from "react";
import { authClient } from "../lib/auth-client";
import { ReplicacheProvider, useRep } from "../lib/replicache/provider";
import { useScan } from "../lib/replicache/hooks";
import { ListingCard } from "../components/auction/listing-card";
import { CreateListingForm } from "../components/auction/create-listing-form";
import { Header } from "../components/layout/header";
import { Footer } from "../components/layout/footer";
import { Hero } from "../components/home/hero";
import * as ws from "../lib/realtime/socket";

type CardDoc = {
  id: string;
  title: string;
  status: string;
  bestAmountCents: number;
  quoteCount: number;
  endsAt: string;
  currency: string;
  ownerId: string;
};

function ListingSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl border border-border/80">
      <div className="aspect-[16/9] animate-pulse bg-muted" />
      <div className="space-y-3 p-4">
        <div className="h-5 w-3/4 animate-pulse rounded-md bg-muted" />
        <div className="flex items-end justify-between pt-1">
          <div className="space-y-1.5">
            <div className="h-2.5 w-14 animate-pulse rounded bg-muted" />
            <div className="h-6 w-20 animate-pulse rounded bg-muted" />
          </div>
          <div className="h-3 w-10 animate-pulse rounded bg-muted" />
        </div>
      </div>
    </div>
  );
}

function HomeFeed() {
  const { data: session } = authClient.useSession();
  const rep = useRep();
  const cards = useScan<CardDoc>("card/");
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    ws.subscribeChannel("poke:feed:home");
  }, []);

  const sorted = [...cards].sort(
    (a, b) => new Date(b.endsAt).getTime() - new Date(a.endsAt).getTime(),
  );

  const isAuthed = !!session?.user;
  const isLoading = !rep;

  return (
    <section className="w-full">
      <header className="flex items-center justify-between gap-5 max-sm:flex-col max-sm:items-start">
        <div className="-space-y-0.5">
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            Live Listings
          </h1>
          <p className="text-sm tracking-tight text-muted-foreground">
            All listings that are currently live
          </p>
        </div>

        {isAuthed && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="rounded-md bg-brand px-4 py-1.5 text-sm font-medium text-white hover:bg-brand/90 transition-colors"
          >
            {showForm ? "Cancel" : "New Listing"}
          </button>
        )}
      </header>

      {showForm && (
        <div className="mt-4 rounded-lg border border-border bg-background p-4">
          <CreateListingForm onCreated={() => setShowForm(false)} />
        </div>
      )}

      {isLoading ? (
        <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <ListingSkeleton key={i} />
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <div className="relative mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <ListingSkeleton key={i} />
          ))}
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center text-center tracking-tighter">
            <h2 className="text-2xl font-semibold text-foreground">
              No listings yet.
            </h2>
            <p className="text-muted-foreground">
              {isAuthed
                ? "Create one to get started."
                : "Sign in to create a listing."}
            </p>
          </div>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {sorted.map((card) => (
            <ListingCard key={card.id} card={card} />
          ))}
        </div>
      )}
    </section>
  );
}

export default function Home() {
  const { data: session, isPending } = authClient.useSession();
  const userId = session?.user?.id ?? null;

  return (
    <ReplicacheProvider userId={userId}>
      <div className="relative flex min-h-screen flex-col">
        <Header />

        <div className="container mx-auto flex grow flex-col px-4">
          <div className="w-full space-y-6 self-center py-4">
            <Hero />
            <div className="flex w-full gap-8 py-3">
              {isPending ? (
                <div className="w-full">
                  <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <ListingSkeleton key={i} />
                    ))}
                  </div>
                </div>
              ) : (
                <div className="w-full">
                  <HomeFeed />
                </div>
              )}
            </div>
          </div>
        </div>

        <Footer />
      </div>
    </ReplicacheProvider>
  );
}
