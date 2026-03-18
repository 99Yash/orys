import type { FinishReason, UIMessage } from "ai";

export type OrysChatMetadata = {
  modelId?: string;
  durationMs?: number;
  finishReason?: FinishReason;
};

export type OrysChatDataParts = {
  status: {
    status: "processing" | "completed";
    message: string;
  };
};

export type OrysMessage = UIMessage<OrysChatMetadata, OrysChatDataParts>;
