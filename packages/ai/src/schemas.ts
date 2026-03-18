import type { FinishReason } from "ai";
import { z } from "zod";

export const finishReasonSchema: z.ZodType<FinishReason> = z.custom<FinishReason>(
  (value) => typeof value === "string",
);

export const chatMetadataSchema = z.object({
  modelId: z.string().optional(),
  durationMs: z.number().int().nonnegative().optional(),
  finishReason: finishReasonSchema.optional(),
});
