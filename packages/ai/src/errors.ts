export class AIError extends Error {
  readonly code: string;
  readonly retryable: boolean;

  constructor(message: string, code: string, retryable = false) {
    super(message);
    this.name = "AIError";
    this.code = code;
    this.retryable = retryable;
  }
}

export class StreamingError extends AIError {
  constructor(message: string, retryable = true) {
    super(message, "STREAMING_ERROR", retryable);
    this.name = "StreamingError";
  }
}
