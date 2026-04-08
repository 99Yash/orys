import { relations } from "drizzle-orm";
import { index, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { user } from "./auth";

export const replicacheClientGroup = pgTable(
  "replicache_client_group",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    cvrVersion: integer("cvr_version").default(0).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("replicache_client_group_userId_idx").on(table.userId),
  ],
);

export const replicacheClient = pgTable(
  "replicache_client",
  {
    id: text("id").primaryKey(),
    clientGroupId: text("client_group_id")
      .notNull()
      .references(() => replicacheClientGroup.id, { onDelete: "cascade" }),
    lastMutationId: integer("last_mutation_id").default(0).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("replicache_client_clientGroupId_idx").on(table.clientGroupId),
  ],
);

export const replicacheClientGroupRelations = relations(
  replicacheClientGroup,
  ({ one, many }) => ({
    user: one(user, {
      fields: [replicacheClientGroup.userId],
      references: [user.id],
    }),
    clients: many(replicacheClient),
  }),
);

export const replicacheClientRelations = relations(
  replicacheClient,
  ({ one }) => ({
    clientGroup: one(replicacheClientGroup, {
      fields: [replicacheClient.clientGroupId],
      references: [replicacheClientGroup.id],
    }),
  }),
);
