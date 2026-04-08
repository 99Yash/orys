CREATE TYPE "public"."listing_status" AS ENUM('DRAFT', 'LIVE', 'ENDED', 'AWARDED');--> statement-breakpoint
CREATE TYPE "public"."quote_status" AS ENUM('ACTIVE', 'WITHDRAWN', 'AWARDED');--> statement-breakpoint
CREATE TABLE "listing" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"status" "listing_status" DEFAULT 'DRAFT' NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"min_step_cents" integer NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"row_version" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quote" (
	"id" text PRIMARY KEY NOT NULL,
	"listing_id" text NOT NULL,
	"user_id" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"status" "quote_status" DEFAULT 'ACTIVE' NOT NULL,
	"row_version" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "replicache_client" (
	"id" text PRIMARY KEY NOT NULL,
	"client_group_id" text NOT NULL,
	"last_mutation_id" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "replicache_client_group" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"cvr_version" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "listing" ADD CONSTRAINT "listing_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote" ADD CONSTRAINT "quote_listing_id_listing_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listing"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote" ADD CONSTRAINT "quote_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "replicache_client" ADD CONSTRAINT "replicache_client_client_group_id_replicache_client_group_id_fk" FOREIGN KEY ("client_group_id") REFERENCES "public"."replicache_client_group"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "replicache_client_group" ADD CONSTRAINT "replicache_client_group_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "listing_ownerId_idx" ON "listing" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "listing_status_idx" ON "listing" USING btree ("status");--> statement-breakpoint
CREATE INDEX "listing_endsAt_idx" ON "listing" USING btree ("ends_at");--> statement-breakpoint
CREATE INDEX "listing_status_endsAt_idx" ON "listing" USING btree ("status","ends_at");--> statement-breakpoint
CREATE UNIQUE INDEX "quote_userId_listingId_idx" ON "quote" USING btree ("user_id","listing_id");--> statement-breakpoint
CREATE INDEX "quote_listingId_idx" ON "quote" USING btree ("listing_id");--> statement-breakpoint
CREATE INDEX "quote_listingId_amountCents_idx" ON "quote" USING btree ("listing_id","amount_cents");--> statement-breakpoint
CREATE INDEX "replicache_client_clientGroupId_idx" ON "replicache_client" USING btree ("client_group_id");--> statement-breakpoint
CREATE INDEX "replicache_client_group_userId_idx" ON "replicache_client_group" USING btree ("user_id");