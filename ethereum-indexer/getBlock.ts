import { getProvider, withProviderRetry } from "../utils/connection.js";

export type GetBlockResult =
  | {
      found: true;
      block: {
        number: number;
        hash: string;
        parentHash: string;
        timestamp: number;
        transactionCount: number;
      };
    }
  | {
      found: false;
      reason: "not_found";
      blockNumber: number;
    };

export async function getBlock(blockNumber: number): Promise<GetBlockResult> {
  const block = await withProviderRetry("getBlock", async () => getProvider().getBlock(blockNumber));

  if (!block || block.number === null || !block.hash) {
    return {
      found: false,
      reason: "not_found",
      blockNumber,
    };
  }

  return {
    found: true,
    block: {
      number: block.number,
      hash: block.hash,
      parentHash: block.parentHash,
      timestamp: block.timestamp,
      transactionCount: block.transactions.length,
    },
  };
}
