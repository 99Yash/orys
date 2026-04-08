"use client";

import { useState } from "react";
import { useRep } from "../../lib/replicache/provider";

const DURATION_OPTIONS = [
  { label: "1 Day", ms: 24 * 60 * 60 * 1000 },
  { label: "3 Days", ms: 3 * 24 * 60 * 60 * 1000 },
  { label: "1 Week", ms: 7 * 24 * 60 * 60 * 1000 },
  { label: "2 Weeks", ms: 14 * 24 * 60 * 60 * 1000 },
];

export function CreateListingForm({ onCreated }: { onCreated?: () => void }) {
  const rep = useRep();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [minStep, setMinStep] = useState("1.00");
  const [duration, setDuration] = useState(DURATION_OPTIONS[2]!.ms);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!rep || !title.trim()) return;

    const listingId = crypto.randomUUID();
    const minStepCents = Math.round(Number.parseFloat(minStep) * 100);

    await rep.mutate.listingCreate({
      listingId,
      title: title.trim(),
      description: description.trim() || undefined,
      endsAtMs: Date.now() + duration,
      minStepCents: Number.isNaN(minStepCents) ? 100 : minStepCents,
      currency: "USD",
    });

    // Auto-publish
    await rep.mutate.listingPublish({ listingId });

    setTitle("");
    setDescription("");
    onCreated?.();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Listing title"
        required
        className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Description (optional)"
        rows={2}
        className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      />
      <div className="flex gap-3">
        <div className="flex-1">
          <label className="text-xs font-medium text-gray-500">
            Min bid step
          </label>
          <input
            type="number"
            step="0.01"
            min="0.01"
            value={minStep}
            onChange={(e) => setMinStep(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <div className="flex-1">
          <label className="text-xs font-medium text-gray-500">Duration</label>
          <select
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            {DURATION_OPTIONS.map((opt) => (
              <option key={opt.ms} value={opt.ms}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <button
        type="submit"
        className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 transition-colors"
      >
        Create & Publish
      </button>
    </form>
  );
}
