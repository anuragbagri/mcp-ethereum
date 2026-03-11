import { describe, expect, it, vi, beforeEach } from "vitest";

const mockGetBlock = vi.fn();

vi.mock("../../utils/connection.js", () => ({
  getProvider: () => ({
    getBlock: mockGetBlock,
  }),
  withProviderRetry: async (_operation: string, fn: () => Promise<unknown>) => fn(),
}));

import { getBlock } from "../../ethereum-indexer/getBlock.js";

describe("getBlock", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns found=true payload when block exists", async () => {
    mockGetBlock.mockResolvedValueOnce({
      number: 10,
      hash: "0xabc",
      parentHash: "0xdef",
      timestamp: 123,
      transactions: ["0x1", "0x2"],
    });

    await expect(getBlock(10)).resolves.toEqual({
      found: true,
      block: {
        number: 10,
        hash: "0xabc",
        parentHash: "0xdef",
        timestamp: 123,
        transactionCount: 2,
      },
    });
  });

  it("returns structured not-found payload when provider returns null", async () => {
    mockGetBlock.mockResolvedValueOnce(null);

    await expect(getBlock(99)).resolves.toEqual({
      found: false,
      reason: "not_found",
      blockNumber: 99,
    });
  });
});
