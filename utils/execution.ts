import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

export type ToolErrorType =
  | "validation_error"
  | "not_found"
  | "transient_provider_error"
  | "provider_error"
  | "internal_error";

export class ToolExecutionError extends Error {
  readonly type: ToolErrorType;
  readonly details?: unknown;

  constructor(type: ToolErrorType, message: string, details?: unknown) {
    super(message);
    this.type = type;
    this.details = details;
  }
}

export function validationError(message: string, details?: unknown): ToolExecutionError {
  return new ToolExecutionError("validation_error", message, details);
}

export function notFoundError(message: string, details?: unknown): ToolExecutionError {
  return new ToolExecutionError("not_found", message, details);
}

function classifyUnknownError(error: unknown): ToolExecutionError {
  if (error instanceof ToolExecutionError) {
    return error;
  }

  const err = error as { message?: string; code?: string | number; shortMessage?: string };
  const message = `${err?.message ?? "Unknown error"} ${err?.shortMessage ?? ""}`.trim();
  const code = String(err?.code ?? "").toUpperCase();
  const normalizedMessage = message.toLowerCase();

  if (code.includes("TIMEOUT") || code.includes("NETWORK") || normalizedMessage.includes("timeout") || normalizedMessage.includes("429")) {
    return new ToolExecutionError("transient_provider_error", message || "Transient provider error", {
      code: err?.code,
    });
  }

  if (normalizedMessage.includes("invalid") || normalizedMessage.includes("malformed")) {
    return new ToolExecutionError("validation_error", message);
  }

  if (code.includes("SERVER") || normalizedMessage.includes("rpc")) {
    return new ToolExecutionError("provider_error", message || "Provider request failed", {
      code: err?.code,
    });
  }

  return new ToolExecutionError("internal_error", message || "Internal error");
}

function toErrorResult(toolName: string, error: ToolExecutionError, durationMs: number): CallToolResult {
  return {
    isError: true,
    content: [
      {
        type: "text",
        text: `${toolName} failed: ${error.message}`,
      },
    ],
    structuredContent: {
      ok: false,
      error: {
        type: error.type,
        message: error.message,
        details: error.details ?? null,
      },
      metadata: {
        toolName,
        durationMs,
      },
    },
  };
}

export async function runTool<T>(
  toolName: string,
  input: Record<string, unknown>,
  fn: () => Promise<T>,
): Promise<CallToolResult> {
  const startedAt = Date.now();
  console.error(JSON.stringify({ level: "info", event: "tool_start", toolName, input, startedAt }));

  try {
    const data = await fn();
    const durationMs = Date.now() - startedAt;
    console.error(JSON.stringify({ level: "info", event: "tool_success", toolName, durationMs }));

    return {
      content: [
        {
          type: "text",
          text: `${toolName} completed successfully in ${durationMs}ms`,
        },
      ],
      structuredContent: {
        ok: true,
        data,
        metadata: {
          toolName,
          durationMs,
        },
      },
    };
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    const classified = classifyUnknownError(error);
    console.error(
      JSON.stringify({
        level: "error",
        event: "tool_error",
        toolName,
        durationMs,
        type: classified.type,
        message: classified.message,
      }),
    );
    return toErrorResult(toolName, classified, durationMs);
  }
}
