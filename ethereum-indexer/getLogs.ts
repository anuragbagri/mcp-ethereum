import { getProvider, getRuntimeConfig, withProviderRetry } from "../utils/connection.js";

type GetLogsParams = {
  address: string;
  fromBlock: number;
  toBlock: number;
  topics?: string[];
  cursor?: number;
  pageSize?: number;
};

export type GetLogsResult = {
  logs: Array<{
    blockNumber: number;
    blockHash: string;
    transactionHash: string;
    transactionIndex: number;
    logIndex: number;
    address: string;
    data: string;
    topics: string[];
    removed: boolean;
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

function parseCursor(cursor: number | undefined, fallback: number, toBlock: number): number {
  if (cursor === undefined) {
    return fallback;
  }

  if (!Number.isInteger(cursor) || cursor < fallback || cursor > toBlock) {
    throw new Error(`cursor must be an integer between ${fallback} and ${toBlock}`);
  }

  return cursor;
}

function normalizeLog(log: Awaited<ReturnType<ReturnType<typeof getProvider>["getLogs"]>>[number]) {
  return {
    blockNumber: log.blockNumber,
    blockHash: log.blockHash,
    transactionHash: log.transactionHash,
    transactionIndex: log.transactionIndex,
    logIndex: log.index,
    address: log.address,
    data: log.data,
    topics: [...log.topics],
    removed: log.removed,
  };
}

export async function getLogs(params: GetLogsParams): Promise<GetLogsResult> {
  const config = getRuntimeConfig();
  const maxWindow = config.maxBlockWindow;
  const pageSize = params.pageSize ?? 500;

  const startBlock = parseCursor(params.cursor, params.fromBlock, params.toBlock);
  const logs: GetLogsResult["logs"] = [];
  let current = startBlock;
  let hasMore = false;
  let nextCursor: string | null = null;

  while (current <= params.toBlock) {
    const chunkEnd = Math.min(current + maxWindow - 1, params.toBlock);
    const chunkLogs = await withProviderRetry("getLogs", async () =>
      getProvider().getLogs({
        address: params.address,
        topics: params.topics,
        fromBlock: current,
        toBlock: chunkEnd,
      }),
    );

    for (const log of chunkLogs) {
      if (logs.length >= pageSize) {
        hasMore = true;
        nextCursor = String(log.blockNumber);
        break;
      }
      logs.push(normalizeLog(log));
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

  logs.sort((a, b) => {
    if (a.blockNumber !== b.blockNumber) {
      return a.blockNumber - b.blockNumber;
    }
    if (a.transactionIndex !== b.transactionIndex) {
      return a.transactionIndex - b.transactionIndex;
    }
    return a.logIndex - b.logIndex;
  });

  return {
    logs,
    pageInfo: {
      fromBlock: startBlock,
      toBlock: params.toBlock,
      nextCursor,
      hasMore,
      returned: logs.length,
      maxBlockWindow: maxWindow,
      pageSize,
    },
  };
}
