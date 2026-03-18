import { z } from "zod";

export interface ModelDescriptor {
  id: string;
  name: string;
  provider: "openai" | "google";
  description: string;
  speed: number;
  intelligence: number;
  isDefault: boolean;
}

export const MODEL_REGISTRY: ModelDescriptor[] = [
  {
    id: "openai:gpt-4.1",
    name: "GPT-4.1",
    provider: "openai",
    description: "High-quality general-purpose model.",
    speed: 4,
    intelligence: 5,
    isDefault: true,
  },
  {
    id: "openai:gpt-4.1-mini",
    name: "GPT-4.1 Mini",
    provider: "openai",
    description: "Fast and cost-efficient model for simple requests.",
    speed: 5,
    intelligence: 3,
    isDefault: false,
  },
  {
    id: "google:gemini-2.5-flash",
    name: "Gemini 2.5 Flash",
    provider: "google",
    description: "Fast model with strong quality for chat-style tasks.",
    speed: 5,
    intelligence: 4,
    isDefault: false,
  },
];

const defaultModel = MODEL_REGISTRY.find((model) => model.isDefault);

if (!defaultModel) {
  throw new Error("MODEL_REGISTRY must contain exactly one default model");
}

export const DEFAULT_CHAT_MODEL_ID = defaultModel.id;

export const VALID_CHAT_MODEL_IDS = MODEL_REGISTRY.map((model) => model.id) as [
  string,
  ...string[],
];

export const chatModelIdSchema = z.enum(VALID_CHAT_MODEL_IDS);

export type ChatModelId = z.infer<typeof chatModelIdSchema>;
