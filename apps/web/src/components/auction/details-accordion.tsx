"use client";

import { formatCents } from "~/lib/utils";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "~/components/ui/accordion";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-foreground">{value}</span>
    </div>
  );
}

export function DetailsAccordion({
  listing,
}: {
  listing: {
    description: string | null;
    minStepCents: number;
    currency: string;
    createdAt: string;
    updatedAt: string;
  };
}) {
  const hasDescription =
    listing.description != null && listing.description.trim().length > 0;

  return (
    <Accordion
      type="multiple"
      defaultValue={["description", "auction-info"]}
    >
      {/* Description section */}
      <AccordionItem value="description">
        <AccordionTrigger>Description</AccordionTrigger>
        <AccordionContent>
          {hasDescription ? (
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
              {listing.description}
            </p>
          ) : (
            <p className="text-sm italic text-muted-foreground">
              No description provided.
            </p>
          )}
        </AccordionContent>
      </AccordionItem>

      {/* Auction Info section */}
      <AccordionItem value="auction-info">
        <AccordionTrigger>Auction Info</AccordionTrigger>
        <AccordionContent>
          <div className="divide-y divide-border/50">
            <DetailRow
              label="Minimum bid step"
              value={formatCents(listing.minStepCents, listing.currency)}
            />
            <DetailRow label="Currency" value={listing.currency} />
            <DetailRow
              label="Created"
              value={formatDate(listing.createdAt)}
            />
            <DetailRow
              label="Last updated"
              value={formatDate(listing.updatedAt)}
            />
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
