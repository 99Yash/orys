"use client";

import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRep } from "~/lib/replicache/provider";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { Button } from "~/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "~/components/ui/form";

const DURATION_OPTIONS = [
  { label: "1 Day", ms: String(24 * 60 * 60 * 1000) },
  { label: "3 Days", ms: String(3 * 24 * 60 * 60 * 1000) },
  { label: "1 Week", ms: String(7 * 24 * 60 * 60 * 1000) },
  { label: "2 Weeks", ms: String(14 * 24 * 60 * 60 * 1000) },
] as const;

const createListingSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters"),
  description: z.string().optional(),
  minStep: z
    .string()
    .min(1, "Enter a minimum bid step")
    .refine(
      (v) => !Number.isNaN(Number.parseFloat(v)) && Number.parseFloat(v) > 0,
      { message: "Must be a positive amount" },
    ),
  duration: z.string().min(1, "Select a duration"),
});

type CreateListingValues = z.infer<typeof createListingSchema>;

export function CreateListingForm({
  onCreated,
}: {
  onCreated?: () => void;
}) {
  const rep = useRep();

  const form = useForm<CreateListingValues>({
    resolver: zodResolver(createListingSchema),
    defaultValues: {
      title: "",
      description: "",
      minStep: "1.00",
      duration: DURATION_OPTIONS[2].ms,
    },
  });

  async function onSubmit(values: CreateListingValues) {
    if (!rep) return;

    const listingId = crypto.randomUUID();
    const minStepCents = Math.round(Number.parseFloat(values.minStep) * 100);

    await rep.mutate.listingCreate({
      listingId,
      title: values.title.trim(),
      description: values.description?.trim() || undefined,
      endsAtMs: Date.now() + Number(values.duration),
      minStepCents: Number.isNaN(minStepCents) ? 100 : minStepCents,
      currency: "USD",
    });

    await rep.mutate.listingPublish({ listingId });

    form.reset();
    onCreated?.();
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex flex-col gap-4"
      >
        {/* Title */}
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Title</FormLabel>
              <FormControl>
                <Input placeholder="Listing title" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Description */}
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Description (optional)"
                  rows={3}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Min step + Duration row */}
        <div className="grid grid-cols-2 gap-3">
          <FormField
            control={form.control}
            name="minStep"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Min bid step</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="0.01"
                    min="0.01"
                    leftAddon="$"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="duration"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Duration</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select duration" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {DURATION_OPTIONS.map((opt) => (
                      <SelectItem key={opt.ms} value={opt.ms}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Submit */}
        <Button
          type="submit"
          variant="brand"
          disabled={form.formState.isSubmitting}
          className="w-full"
        >
          {form.formState.isSubmitting
            ? "Creating..."
            : "Create & Publish"}
        </Button>
      </form>
    </Form>
  );
}
