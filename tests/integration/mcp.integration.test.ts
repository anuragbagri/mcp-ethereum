import { afterAll, beforeAll, describe, expect, it } from "vitest";
import net from "node:net";
import ganache from "ganache";
import { ethers } from "ethers";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

let ganacheServer: any;
let client: Client;
let transport: StdioClientTransport;
let blockNumber = 0;
let txHash = "";
let rpcPort = 0;

function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close();
        reject(new Error("Unable to allocate free port"));
        return;
      }
      const port = address.port;
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(port);
      });
    });
    server.on("error", reject);
  });
}

beforeAll(async () => {
  rpcPort = await getFreePort();
  ganacheServer = (ganache as any).server({
    logging: { quiet: true },
    chain: { chainId: 1337 },
    wallet: { totalAccounts: 2 },
  });

  await ganacheServer.listen(rpcPort, "127.0.0.1");

  const provider = new ethers.JsonRpcProvider(`http://127.0.0.1:${rpcPort}`);
  const accounts = await provider.listAccounts();
  const signer = await provider.getSigner(accounts[0].address);
  const tx = await signer.sendTransaction({ to: accounts[1].address, value: 1n });
  const receipt = await tx.wait();

  if (!receipt) {
    throw new Error("Failed to mine integration transaction");
  }

  blockNumber = receipt.blockNumber;
  txHash = tx.hash;

  client = new Client({
    name: "integration-test-client",
    version: "1.0.0",
  });

  transport = new StdioClientTransport({
    command: "bun",
    args: ["run", "index.ts"],
    cwd: process.cwd(),
    env: {
      ...process.env,
      MCP_TRANSPORT: "stdio",
      RPC_URL: `http://127.0.0.1:${rpcPort}`,
      EXPECTED_CHAIN_ID: "1337",
      MAX_BLOCK_WINDOW: "10",
    } as Record<string, string>,
    stderr: "pipe",
  });

  await client.connect(transport);
}, 90_000);

afterAll(async () => {
  if (transport) {
    await transport.close();
  }
  if (ganacheServer) {
    try {
      await ganacheServer.close();
    } catch {
      // noop in teardown for partially initialized servers
    }
  }
});

describe("MCP integration", () => {
  it("returns structured block data through MCP callTool", async () => {
    const result = await client.callTool({
      name: "getBlock",
      arguments: { blockNumber },
    });

    const content = result.structuredContent as { ok: boolean; data: { found: boolean } };
    expect(content.ok).toBe(true);
    expect(content.data.found).toBe(true);
  });

  it("returns transaction payload through MCP callTool", async () => {
    const result = await client.callTool({
      name: "getTransaction",
      arguments: { txHash },
    });

    const content = result.structuredContent as { ok: boolean; data: { found: boolean } };
    expect(content.ok).toBe(true);
    expect(content.data.found).toBe(true);
  });

  it("returns log pagination metadata through MCP callTool", async () => {
    const result = await client.callTool({
      name: "getLogs",
      arguments: {
        address: "0x" + "0".repeat(40),
        fromBlock: 0,
        toBlock: blockNumber,
        pageSize: 1,
      },
    });

    const content = result.structuredContent as {
      ok: boolean;
      data: { pageInfo: { returned: number; hasMore: boolean } };
    };

    expect(content.ok).toBe(true);
    expect(content.data.pageInfo.returned).toBeGreaterThanOrEqual(0);
    expect(typeof content.data.pageInfo.hasMore).toBe("boolean");
  });
});
