"use client";

import { useState, useEffect, useMemo } from "react";
import { authClient } from "../lib/auth-client";
import { ReplicacheProvider, useRep } from "../lib/replicache/provider";
import { useSubscribe } from "../lib/replicache/hooks";
import { ListingManager, type CardDoc } from "../lib/auction/managers";
import { ListingCard } from "../components/auction/listing-card";
import { CreateListingForm } from "../components/auction/create-listing-form";
import { Header } from "../components/layout/header";
import { Footer } from "../components/layout/footer";
import { Hero } from "../components/home/hero";
import { Filter } from "../components/auction/filter";
import { Sort } from "../components/auction/sort";
import { Modal } from "~/components/ui/modal";
import { Button } from "~/components/ui/button";
import * as ws from "../lib/realtime/socket";

const STATUS_OPTIONS = ["DRAFT", "LIVE", "ENDED", "AWARDED"];

function HomeFeed({ userId }: { userId: string | null }) {
  const rep = useRep();
  const cards = useSubscribe<CardDoc[]>((tx) => ListingManager.scanCards(tx), []);
  const [showForm, setShowForm] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [sort, setSort] = useState<{ field: string; direction: "asc" | "desc" }>({
    field: "newest",
    direction: "desc",
  });

  useEffect(() => {
    ws.subscribeChannel("poke:feed:home");
  }, []);

  const isAuthed = userId !== null;
  const isLoading = !rep;

  const filtered = useMemo(() => {
    let result = [...cards];

    // Apply status filter
    if (statusFilter.length > 0 && statusFilter.length < STATUS_OPTIONS.length) {
      result = result.filter((c) => statusFilter.includes(c.status));
    }

    // Apply sort
    result.sort((a, b) => {
      const dir = sort.direction === "asc" ? 1 : -1;
      switch (sort.field) {
        case "newest":
          return dir * (new Date(b.endsAt).getTime() - new Date(a.endsAt).getTime());
        case "ending-soon":
          return dir * (new Date(a.endsAt).getTime() - new Date(b.endsAt).getTime());
        case "most-bids":
          return dir * (b.quoteCount - a.quoteCount);
        case "highest-bid":
          return dir * (b.bestAmountCents - a.bestAmountCents);
        default:
          return 0;
      }
    });

    return result;
  }, [cards, statusFilter, sort]);

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
          <Button variant="brand" onClick={() => setShowForm(true)}>
            New Listing
          </Button>
        )}
      </header>

      {/* Filter & Sort toolbar */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Filter
          label="Status"
          options={STATUS_OPTIONS}
          selected={statusFilter}
          onSelect={setStatusFilter}
        />
        <Sort value={sort} onChange={setSort} />
      </div>

      {/* Create listing modal */}
      <Modal
        showModal={showForm}
        setShowModal={setShowForm}
        title="Create Listing"
        description="Fill in the details to create a new auction listing."
      >
        <CreateListingForm onCreated={() => setShowForm(false)} />
      </Modal>

      {isLoading ? (
        <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <ListingCard.Skeleton key={i} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="relative mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <ListingCard.Skeleton key={i} />
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
          {filtered.map((card) => (
            <ListingCard key={card.id} card={card} userId={userId} />
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
                      <ListingCard.Skeleton key={i} />
                    ))}
                  </div>
                </div>
              ) : (
                <div className="w-full">
                  <HomeFeed userId={userId} />
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
