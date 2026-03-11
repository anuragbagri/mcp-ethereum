import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { getServer } from "./utils/server.js";
import { validateProviderNetwork } from "./utils/connection.js";

function readJsonBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];

    req.on("data", (chunk: Buffer) => {
      chunks.push(chunk);
    });

    req.on("end", () => {
      if (chunks.length === 0) {
        resolve(undefined);
        return;
      }

      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch (error) {
        reject(new Error(`Invalid JSON request body: ${(error as Error).message}`));
      }
    });

    req.on("error", (error) => {
      reject(error);
    });
  });
}

function installShutdownHandlers(shutdown: () => Promise<void>): void {
  const signals: NodeJS.Signals[] = ["SIGINT", "SIGTERM"];
  for (const signal of signals) {
    process.once(signal, async () => {
      try {
        await shutdown();
        process.exit(0);
      } catch (error) {
        console.error(`Shutdown error after ${signal}:`, error);
        process.exit(1);
      }
    });
  }
}

async function startStdio(): Promise<void> {
  const server = getServer();
  const transport = new StdioServerTransport();

  await validateProviderNetwork();
  await server.connect(transport);

  installShutdownHandlers(async () => {
    await server.close();
  });

  console.error("MCP Ethereum server started on stdio transport");
}

async function startHttp(): Promise<void> {
  const server = getServer();
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  await validateProviderNetwork();
  await server.connect(transport);

  const port = Number(process.env.PORT ?? 3000);
  const httpServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    try {
      if (!req.url) {
        res.statusCode = 400;
        res.end("Missing URL");
        return;
      }

      if (req.url === "/health") {
        res.setHeader("content-type", "application/json");
        res.statusCode = 200;
        res.end(JSON.stringify({ status: "ok" }));
        return;
      }

      if (req.url !== "/mcp") {
        res.statusCode = 404;
        res.end("Not Found");
        return;
      }

      const body = req.method === "POST" ? await readJsonBody(req) : undefined;
      await transport.handleRequest(req, res, body);
    } catch (error) {
      console.error("HTTP request handling error:", error);
      res.statusCode = 400;
      res.setHeader("content-type", "application/json");
      res.end(
        JSON.stringify({
          jsonrpc: "2.0",
          error: {
            code: -32000,
            message: (error as Error).message,
          },
          id: null,
        }),
      );
    }
  });

  await new Promise<void>((resolve) => httpServer.listen(port, resolve));

  installShutdownHandlers(async () => {
    await new Promise<void>((resolve, reject) => {
      httpServer.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
    await server.close();
  });

  console.error(`MCP Ethereum server started on streamable HTTP transport at http://localhost:${port}/mcp`);
}

async function main(): Promise<void> {
  const transport = process.env.MCP_TRANSPORT === "http" ? "http" : "stdio";

  if (transport === "http") {
    await startHttp();
    return;
  }

  await startStdio();
}

main().catch((error) => {
  console.error("Fatal startup error:", error);
  process.exit(1);
});
