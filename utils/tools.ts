import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getBlock } from "../ethereum-indexer/getBlock.js";
import { getLogs } from "../ethereum-indexer/getLogs.js";
import { getTransaction } from "../ethereum-indexer/getTransaction.js";
import { parseAndValidateAbi, searchEvents } from "../ethereum-indexer/searchEvents.js";
import { runTool, validationError } from "./execution.js";

const ethAddressRegex = /^0x[a-fA-F0-9]{40}$/;
const txHashRegex = /^0x[a-fA-F0-9]{64}$/;

const blockNumberSchema = z.number().int().nonnegative();
const optionalCursorSchema = z.number().int().nonnegative().optional();
const pageSizeSchema = z.number().int().positive().max(2000).optional();

function assertBlockRange(fromBlock: number, toBlock: number): void {
  if (fromBlock > toBlock) {
    throw validationError("fromBlock must be less than or equal to toBlock", { fromBlock, toBlock });
  }
}

export function registerEthereumTools(server: McpServer): void {
  server.registerTool(
    "getBlock",
    {
      description: "Fetch Ethereum block details by number",
      inputSchema: {
        blockNumber: blockNumberSchema,
      },
    },
    async ({ blockNumber }) => runTool("getBlock", { blockNumber }, async () => getBlock(blockNumber)),
  );

  server.registerTool(
    "getLogs",
    {
      description: "Fetch logs from a contract within a block range",
      inputSchema: {
        address: z.string().regex(ethAddressRegex, "address must be a valid 0x-prefixed 20-byte hex address"),
        fromBlock: blockNumberSchema,
        toBlock: blockNumberSchema,
        topics: z.array(z.string().regex(txHashRegex, "topics entries must be 32-byte hex values")).optional(),
        cursor: optionalCursorSchema,
        pageSize: pageSizeSchema,
      },
    },
    async ({ address, fromBlock, toBlock, topics, cursor, pageSize }) =>
      runTool(
        "getLogs",
        { address, fromBlock, toBlock, cursor, pageSize },
        async () => {
          assertBlockRange(fromBlock, toBlock);
          if (cursor !== undefined && (cursor < fromBlock || cursor > toBlock)) {
            throw validationError("cursor must be within the requested block range", {
              cursor,
              fromBlock,
              toBlock,
            });
          }

          return getLogs({
            address,
            fromBlock,
            toBlock,
            topics,
            cursor,
            pageSize,
          });
        },
      ),
  );

  server.registerTool(
    "getTransaction",
    {
      description: "Fetch Ethereum transaction details by hash",
      inputSchema: {
        txHash: z.string().regex(txHashRegex, "txHash must be a valid 32-byte transaction hash"),
      },
    },
    async ({ txHash }) => runTool("getTransaction", { txHash }, async () => getTransaction(txHash)),
  );

  server.registerTool(
    "searchEvents",
    {
      description: "Search and decode contract events by ABI and event name",
      inputSchema: {
        contractAddress: z
          .string()
          .regex(ethAddressRegex, "contractAddress must be a valid 0x-prefixed 20-byte hex address"),
        abi: z.unknown(),
        eventName: z.string().min(1),
        fromBlock: blockNumberSchema,
        toBlock: blockNumberSchema,
        cursor: optionalCursorSchema,
        pageSize: z.number().int().positive().max(1000).optional(),
      },
    },
    async ({ contractAddress, abi, eventName, fromBlock, toBlock, cursor, pageSize }) =>
      runTool(
        "searchEvents",
        { contractAddress, eventName, fromBlock, toBlock, cursor, pageSize },
        async () => {
          assertBlockRange(fromBlock, toBlock);
          if (cursor !== undefined && (cursor < fromBlock || cursor > toBlock)) {
            throw validationError("cursor must be within the requested block range", {
              cursor,
              fromBlock,
              toBlock,
            });
          }

          const validatedAbi = parseAndValidateAbi(abi);
          return searchEvents({
            contractAddress,
            abi: validatedAbi,
            eventName,
            fromBlock,
            toBlock,
            cursor,
            pageSize,
          });
        },
      ),
  );
}
