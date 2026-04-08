import { relations } from "drizzle-orm";
import {
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { user } from "./auth";

export const listingStatusEnum = pgEnum("listing_status", [
  "DRAFT",
  "LIVE",
  "ENDED",
  "AWARDED",
]);

export const quoteStatusEnum = pgEnum("quote_status", [
  "ACTIVE",
  "WITHDRAWN",
  "AWARDED",
]);

export const listing = pgTable(
  "listing",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    status: listingStatusEnum("status").default("DRAFT").notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    minStepCents: integer("min_step_cents").notNull(),
    currency: text("currency").default("USD").notNull(),
    rowVersion: integer("row_version").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("listing_ownerId_idx").on(table.ownerId),
    index("listing_status_idx").on(table.status),
    index("listing_endsAt_idx").on(table.endsAt),
    index("listing_status_endsAt_idx").on(table.status, table.endsAt),
  ],
);

export const quote = pgTable(
  "quote",
  {
    id: text("id").primaryKey(),
    listingId: text("listing_id")
      .notNull()
      .references(() => listing.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    amountCents: integer("amount_cents").notNull(),
    status: quoteStatusEnum("status").default("ACTIVE").notNull(),
    rowVersion: integer("row_version").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("quote_userId_listingId_idx").on(
      table.userId,
      table.listingId,
    ),
    index("quote_listingId_idx").on(table.listingId),
    index("quote_listingId_amountCents_idx").on(
      table.listingId,
      table.amountCents,
    ),
  ],
);

export const listingRelations = relations(listing, ({ one, many }) => ({
  owner: one(user, {
    fields: [listing.ownerId],
    references: [user.id],
  }),
  quotes: many(quote),
}));

export const quoteRelations = relations(quote, ({ one }) => ({
  listing: one(listing, {
    fields: [quote.listingId],
    references: [listing.id],
  }),
  user: one(user, {
    fields: [quote.userId],
    references: [user.id],
  }),
}));
