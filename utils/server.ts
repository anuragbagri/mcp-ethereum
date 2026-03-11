import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerEthereumTools } from "./tools.js";

export function getServer(): McpServer {
  const server = new McpServer({
    name: "ethereum-indexer",
    version: "1.0.0",
  });

  registerEthereumTools(server);
  return server;
}
