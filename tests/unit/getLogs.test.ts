import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetLogs = vi.fn();

vi.mock("../../utils/connection.js", () => ({
  getProvider: () => ({
    getLogs: mockGetLogs,
  }),
  getRuntimeConfig: () => ({
    maxBlockWindow: 2,
  }),
  withProviderRetry: async (_operation: string, fn: () => Promise<unknown>) => fn(),
}));

import { getLogs } from "../../ethereum-indexer/getLogs.js";

function buildLog(blockNumber: number, index: number) {
  return {
    blockNumber,
    blockHash: "0x" + String(blockNumber).padStart(64, "0"),
    transactionHash: "0x" + String(index + 1).padStart(64, "0"),
    transactionIndex: 0,
    index,
    address: "0x" + "1".repeat(40),
    data: "0x",
    topics: [],
    removed: false,
  };
}

describe("getLogs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("chunks long block ranges and returns deterministic order", async () => {
    mockGetLogs
      .mockResolvedValueOnce([buildLog(1, 0), buildLog(2, 0)])
      .mockResolvedValueOnce([buildLog(3, 0)]);

    const result = await getLogs({
      address: "0x" + "1".repeat(40),
      fromBlock: 1,
      toBlock: 3,
    });

    expect(mockGetLogs).toHaveBeenCalledTimes(2);
    expect(result.logs.map((log) => log.blockNumber)).toEqual([1, 2, 3]);
    expect(result.pageInfo.hasMore).toBe(false);
    expect(result.pageInfo.nextCursor).toBeNull();
  });

  it("supports cursor pagination with hasMore metadata", async () => {
    mockGetLogs.mockResolvedValueOnce([buildLog(5, 0), buildLog(5, 1), buildLog(6, 0)]);

    const result = await getLogs({
      address: "0x" + "2".repeat(40),
      fromBlock: 5,
      toBlock: 6,
      cursor: 5,
      pageSize: 2,
    });

    expect(result.logs).toHaveLength(2);
    expect(result.pageInfo.hasMore).toBe(true);
    expect(result.pageInfo.nextCursor).toBe("6");
  });
});
