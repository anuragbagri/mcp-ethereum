import { Server } from "@modelcontextprotocol/sdk/server";
import { registerEthereumTools } from "./tools";

export function getServer() {
    const server = new Server({
        name : "ethereum-indexer",
        version : "1.0.0"
    });

    // tools or endpoints function 
    registerEthereumTools(server);
    return server;
}