import { ethers } from "ethers";
import { getProvider, getRuntimeConfig, withProviderRetry } from "../utils/connection.js";

type SearchEventsParams = {
  contractAddress: string;
  abi: ethers.InterfaceAbi;
  eventName: string;
  fromBlock: number;
  toBlock: number;
  cursor?: number;
  pageSize?: number;
};

export type SearchEventsResult = {
  events: Array<{
    blockNumber: number;
    transactionHash: string;
    logIndex: number;
    eventName: string;
    args: Record<string, string>;
  }>;
  pageInfo: {
    fromBlock: number;
    toBlock: number;
    nextCursor: string | null;
    hasMore: boolean;
    returned: number;
    maxBlockWindow: number;
    pageSize: number;
  };
};

export function parseAndValidateAbi(abi: unknown): ethers.InterfaceAbi {
  if (!Array.isArray(abi)) {
    throw new Error("abi must be an array");
  }

  try {
    const iface = new ethers.Interface(abi as ethers.InterfaceAbi);
    // Accessing fragments ensures malformed ABI is rejected early.
    if (iface.fragments.length === 0) {
      throw new Error("abi does not contain any fragments");
    }
    return abi as ethers.InterfaceAbi;
  } catch (error) {
    throw new Error(`Invalid ABI: ${(error as Error).message}`);
  }
}

function parseCursor(cursor: number | undefined, fallback: number, toBlock: number): number {
  if (cursor === undefined) {
    return fallback;
  }

  if (!Number.isInteger(cursor) || cursor < fallback || cursor > toBlock) {
    throw new Error(`cursor must be an integer between ${fallback} and ${toBlock}`);
  }

  return cursor;
}

export async function searchEvents(params: SearchEventsParams): Promise<SearchEventsResult> {
  const config = getRuntimeConfig();
  const maxWindow = config.maxBlockWindow;
  const pageSize = params.pageSize ?? 250;
  const iface = new ethers.Interface(params.abi);
  const eventFragment = iface.getEvent(params.eventName);
  if (!eventFragment) {
    throw new Error(`Event \"${params.eventName}\" not found in ABI`);
  }

  const topics = iface.encodeFilterTopics(eventFragment, []);
  const startBlock = parseCursor(params.cursor, params.fromBlock, params.toBlock);

  const events: SearchEventsResult["events"] = [];
  let current = startBlock;
  let hasMore = false;
  let nextCursor: string | null = null;

  while (current <= params.toBlock) {
    const chunkEnd = Math.min(current + maxWindow - 1, params.toBlock);
    const logs = await withProviderRetry("searchEvents.getLogs", async () =>
      getProvider().getLogs({
        address: params.contractAddress,
        fromBlock: current,
        toBlock: chunkEnd,
        topics,
      }),
    );

    for (const log of logs) {
      const parsed = iface.parseLog(log);
      if (!parsed) {
        continue;
      }

      const args: Record<string, string> = {};
      parsed.fragment.inputs.forEach((input, idx) => {
        const raw = parsed.args[idx];
        const rendered = typeof raw === "bigint" ? raw.toString() : String(raw);
        args[input.name || String(idx)] = rendered;
      });

      if (events.length >= pageSize) {
        hasMore = true;
        nextCursor = String(log.blockNumber);
        break;
      }

      events.push({
        blockNumber: log.blockNumber,
        transactionHash: log.transactionHash,
        logIndex: log.index,
        eventName: parsed.name,
        args,
      });
    }

    if (hasMore) {
      break;
    }

    if (chunkEnd < params.toBlock) {
      nextCursor = String(chunkEnd + 1);
    } else {
      nextCursor = null;
    }

    current = chunkEnd + 1;
  }

  events.sort((a, b) => {
    if (a.blockNumber !== b.blockNumber) {
      return a.blockNumber - b.blockNumber;
    }
    return a.logIndex - b.logIndex;
  });

  return {
    events,
    pageInfo: {
      fromBlock: startBlock,
      toBlock: params.toBlock,
      nextCursor,
      hasMore,
      returned: events.length,
      maxBlockWindow: maxWindow,
      pageSize,
    },
  };
}
