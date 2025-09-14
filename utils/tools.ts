import { getBlock } from "../ethereum-indexer/getBlock";
import { getLogs } from "../ethereum-indexer/getLogs";
import { getTransaction } from "../ethereum-indexer/getTransaction";
import { searchEvents } from "../ethereum-indexer/searchEvents";
import type { Server } from "@modelcontextprotocol/sdk/server";

export function registerEthereumTools(server: Server) {
  // 4 tools or endpoints
  // Register getBlock tool
  server.registerTool({
    name: "getBlock",
    description: "Fetch Ethereum block details by number",
    inputSchema: {
      type: "object",
      properties: {
        blockNumber: { type: "number" },
      },
      required: ["blockNumber"],
    },
    async execute({ blockNumber }: { blockNumber: number }) {
      const block = await getBlock(blockNumber);
      return { block };
    },
  });

  // Register getLogs tool
  server.registerTool({
    name: "getLogs",
    description: "Fetch logs from a contract within a block range",
    inputSchema: {
      type: "object",
      properties: {
        address: { type: "string" },
        fromBlock: { type: "number" },
        toBlock: { type: "number" },
        topics: { type: "array", items: { type: "string" }, default: [] },
      },
      required: ["address", "fromBlock", "toBlock"],
    },
    async execute({
      address,
      fromBlock,
      toBlock,
      topics,
    }: {
      address: string;
      fromBlock: number;
      toBlock: number;
      topics?: string[];
    }) {
      const logs = await getLogs(address, fromBlock, toBlock, topics || []);
      return { logs };
    },
  });

  // Register getTransaction tool
  server.registerTool({
    name: "getTransaction",
    description: "Fetch Ethereum transaction details by hash",
    inputSchema: {
      type: "object",
      properties: {
        txHash: { type: "string" },
      },
      required: ["txHash"],
    },
    async execute({ txHash }: { txHash: string }) {
      const tx = await getTransaction(txHash);
      return { tx };
    },
  });

  //Register searchEvents tool
  server.registerTool({
    name: "searchEvents",
    description: "Search & decode contract events by ABI and name",
    inputSchema: {
      type: "object",
      properties: {
        contractAddress: { type: "string" },
        abi: { type: "any" },
        eventName: { type: "string" },
        fromBlock: { type: "number" },
        toBlock: { type: "number" },
      },
      required: ["contractAddress", "abi", "eventName", "fromBlock", "toBlock"],
    },
    async execute({
      contractAddress,
      abi,
      eventName,
      fromBlock,
      toBlock,
    }: {
      contractAddress: string;
      abi: any;
      eventName: string;
      fromBlock: number;
      toBlock: number;
    }) {
      const events = await searchEvents(
        contractAddress,
        abi,
        eventName,
        fromBlock,
        toBlock
      );
      return { events };
    },
  });
}
