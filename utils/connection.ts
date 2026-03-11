import dotenv from "dotenv";
import { ethers } from "ethers";

dotenv.config();

export type RuntimeConfig = {
  rpcUrl: string;
  expectedChainId?: number;
  requestTimeoutMs: number;
  retryMaxAttempts: number;
  retryBaseDelayMs: number;
  maxBlockWindow: number;
};

let cachedConfig: RuntimeConfig | undefined;
let cachedProvider: ethers.JsonRpcProvider | undefined;

function parsePositiveInt(value: string | undefined, fallback: number, key: string): number {
  if (!value || value.trim() === "") {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${key} must be a positive integer. Received: ${value}`);
  }

  return parsed;
}

function parseOptionalChainId(value: string | undefined): number | undefined {
  if (!value || value.trim() === "") {
    return undefined;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`EXPECTED_CHAIN_ID must be a positive integer. Received: ${value}`);
  }

  return parsed;
}

function validateRpcUrl(rpcUrl: string | undefined): string {
  if (!rpcUrl || rpcUrl.trim() === "") {
    throw new Error("RPC_URL is required. Set RPC_URL in your environment before starting the server.");
  }

  try {
    const url = new URL(rpcUrl);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new Error("RPC_URL must use http or https protocol.");
    }
  } catch (error) {
    throw new Error(`RPC_URL is malformed: ${(error as Error).message}`);
  }

  return rpcUrl;
}

export function getRuntimeConfig(): RuntimeConfig {
  if (cachedConfig) {
    return cachedConfig;
  }

  cachedConfig = {
    rpcUrl: validateRpcUrl(process.env.RPC_URL),
    expectedChainId: parseOptionalChainId(process.env.EXPECTED_CHAIN_ID),
    requestTimeoutMs: parsePositiveInt(process.env.RPC_REQUEST_TIMEOUT_MS, 15_000, "RPC_REQUEST_TIMEOUT_MS"),
    retryMaxAttempts: parsePositiveInt(process.env.RPC_RETRY_MAX_ATTEMPTS, 3, "RPC_RETRY_MAX_ATTEMPTS"),
    retryBaseDelayMs: parsePositiveInt(process.env.RPC_RETRY_BASE_DELAY_MS, 300, "RPC_RETRY_BASE_DELAY_MS"),
    maxBlockWindow: parsePositiveInt(process.env.MAX_BLOCK_WINDOW, 2_000, "MAX_BLOCK_WINDOW"),
  };

  return cachedConfig;
}

export function getProvider(): ethers.JsonRpcProvider {
  if (cachedProvider) {
    return cachedProvider;
  }

  const config = getRuntimeConfig();
  cachedProvider = new ethers.JsonRpcProvider(config.rpcUrl);
  return cachedProvider;
}

function isTransientProviderError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const err = error as { code?: string | number; message?: string; shortMessage?: string };
  const code = String(err.code ?? "").toUpperCase();
  const message = `${err.message ?? ""} ${err.shortMessage ?? ""}`.toLowerCase();

  return (
    code.includes("TIMEOUT") ||
    code.includes("NETWORK") ||
    code.includes("SERVER") ||
    message.includes("timeout") ||
    message.includes("rate") ||
    message.includes("429") ||
    message.includes("temporarily") ||
    message.includes("econnreset") ||
    message.includes("econnrefused") ||
    message.includes("etimedout")
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, operationName: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(`${operationName} timed out after ${timeoutMs}ms`)), timeoutMs);
    }),
  ]);
}

export async function withProviderRetry<T>(
  operationName: string,
  operation: () => Promise<T>,
): Promise<T> {
  const config = getRuntimeConfig();

  let lastError: unknown;
  for (let attempt = 1; attempt <= config.retryMaxAttempts; attempt += 1) {
    try {
      return await withTimeout(operation(), config.requestTimeoutMs, operationName);
    } catch (error) {
      lastError = error;
      const shouldRetry = isTransientProviderError(error) && attempt < config.retryMaxAttempts;
      if (!shouldRetry) {
        throw error;
      }

      const delayMs = config.retryBaseDelayMs * Math.pow(2, attempt - 1);
      await sleep(delayMs);
    }
  }

  throw lastError;
}

export async function validateProviderNetwork(): Promise<void> {
  const config = getRuntimeConfig();
  if (!config.expectedChainId) {
    return;
  }

  const network = await withProviderRetry("provider.getNetwork", async () => getProvider().getNetwork());
  const chainId = Number(network.chainId);
  if (chainId !== config.expectedChainId) {
    throw new Error(
      `RPC chain ID mismatch. Expected ${config.expectedChainId}, got ${chainId}. Check RPC_URL/EXPECTED_CHAIN_ID.`,
    );
  }
}

export function __resetConnectionForTests(): void {
  cachedConfig = undefined;
  cachedProvider = undefined;
}
