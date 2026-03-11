import { describe, expect, it, vi, beforeEach } from "vitest";

const mockGetTransaction = vi.fn();

vi.mock("../../utils/connection.js", () => ({
  getProvider: () => ({
    getTransaction: mockGetTransaction,
  }),
  withProviderRetry: async (_operation: string, fn: () => Promise<unknown>) => fn(),
}));

import { getTransaction } from "../../ethereum-indexer/getTransaction.js";

describe("getTransaction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns found=true payload when tx exists", async () => {
    mockGetTransaction.mockResolvedValueOnce({
      hash: "0x" + "a".repeat(64),
      from: "0x" + "1".repeat(40),
      to: "0x" + "2".repeat(40),
      value: 123n,
      blockNumber: 12,
      nonce: 2,
    });

    await expect(getTransaction("0x" + "a".repeat(64))).resolves.toEqual({
      found: true,
      transaction: {
        hash: "0x" + "a".repeat(64),
        from: "0x" + "1".repeat(40),
        to: "0x" + "2".repeat(40),
        value: "123",
        blockNumber: 12,
        nonce: 2,
      },
    });
  });

  it("returns structured not-found payload when tx is missing", async () => {
    mockGetTransaction.mockResolvedValueOnce(null);

    await expect(getTransaction("0x" + "f".repeat(64))).resolves.toEqual({
      found: false,
      reason: "not_found",
      txHash: "0x" + "f".repeat(64),
    });
  });
});
