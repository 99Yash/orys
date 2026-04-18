"use client";

import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRep } from "~/lib/replicache/provider";
import { formatCents } from "~/lib/utils";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "~/components/ui/form";

function makeBidSchema(minBidDollars: number) {
  return z.object({
    amount: z
      .string()
      .min(1, "Enter a bid amount")
      .refine((v) => !Number.isNaN(Number.parseFloat(v)) && Number.parseFloat(v) > 0, {
        message: "Enter a valid amount",
      })
      .refine((v) => Number.parseFloat(v) >= minBidDollars, {
        message: `Minimum bid is $${minBidDollars.toFixed(2)}`,
      }),
  });
}

type BidFormValues = z.infer<ReturnType<typeof makeBidSchema>>;

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
  const minBidCents = currentBestCents + minStepCents;
  const minBidDollars = minBidCents / 100;

  const form = useForm<BidFormValues>({
    resolver: zodResolver(makeBidSchema(minBidDollars)),
    defaultValues: { amount: "" },
  });

  const watchedAmount = form.watch("amount");
  const parsedAmount = Number.parseFloat(watchedAmount);
  const commissionCents =
    !Number.isNaN(parsedAmount) && parsedAmount > 0
      ? Math.round(parsedAmount * 100 * 0.05)
      : 0;

  async function onSubmit(values: BidFormValues) {
    if (!rep) return;
    const amountCents = Math.round(Number.parseFloat(values.amount) * 100);

    await rep.mutate.quoteUpsert({
      listingId,
      quoteId: crypto.randomUUID(),
      amountCents,
    });

    form.reset();
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
        <label className="text-sm font-medium text-foreground">
          Place your bid
        </label>

        <div className="flex gap-2">
          <FormField
            control={form.control}
            name="amount"
            render={({ field }) => (
              <FormItem className="flex-1 space-y-0">
                <FormControl>
                  <Input
                    type="number"
                    step="0.01"
                    min={minBidDollars}
                    placeholder={minBidDollars.toFixed(2)}
                    leftAddon="$"
                    {...field}
                  />
                </FormControl>
              </FormItem>
            )}
          />
          <Button
            type="submit"
            variant="brand"
            disabled={form.formState.isSubmitting}
          >
            {form.formState.isSubmitting ? "Bidding..." : "Bid"}
          </Button>
        </div>

        {/* Error or hint */}
        <FormField
          control={form.control}
          name="amount"
          render={() => (
            <FormItem className="space-y-0">
              <FormMessage />
            </FormItem>
          )}
        />

        {!form.formState.errors.amount && (
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              Minimum: {formatCents(minBidCents, currency)}
            </span>
            {commissionCents > 0 && (
              <span>
                Commission (5%): {formatCents(commissionCents, currency)}
              </span>
            )}
          </div>
        )}
      </form>
    </Form>
  );
}
