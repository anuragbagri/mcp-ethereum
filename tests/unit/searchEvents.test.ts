import { beforeEach, describe, expect, it, vi } from "vitest";
import { ethers } from "ethers";

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

import { parseAndValidateAbi, searchEvents } from "../../ethereum-indexer/searchEvents.js";

const abi = ["event Transfer(address indexed from, address indexed to, uint256 value)"];
const iface = new ethers.Interface(abi);

function buildTransferLog(from: string, to: string, value: bigint, blockNumber: number, index: number) {
  const fragment = iface.getEvent("Transfer");
  if (!fragment) {
    throw new Error("Transfer event fragment not found in ABI");
  }
  const encoded = iface.encodeEventLog(fragment, [from, to, value]);

  return {
    blockNumber,
    transactionHash: "0x" + String(index + 1).padStart(64, "0"),
    index,
    data: encoded.data,
    topics: encoded.topics,
  };
}

describe("searchEvents", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects malformed ABI", () => {
    expect(() => parseAndValidateAbi("not-an-array")).toThrow("abi must be an array");
  });

  it("decodes logs into deterministic event payloads", async () => {
    mockGetLogs
      .mockResolvedValueOnce([
        buildTransferLog("0x" + "1".repeat(40), "0x" + "2".repeat(40), 10n, 1, 0),
        buildTransferLog("0x" + "1".repeat(40), "0x" + "3".repeat(40), 20n, 2, 0),
      ])
      .mockResolvedValueOnce([]);

    const result = await searchEvents({
      contractAddress: "0x" + "a".repeat(40),
      abi,
      eventName: "Transfer",
      fromBlock: 1,
      toBlock: 3,
    });

    expect(mockGetLogs).toHaveBeenCalledTimes(2);
    expect(result.events).toHaveLength(2);
    expect(result.events[0]?.args.value).toBe("10");
    expect(result.pageInfo.hasMore).toBe(false);
  });
});
