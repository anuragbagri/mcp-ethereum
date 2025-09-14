# Ethereum MCP Server

This project provides a **Model Context Protocol (MCP)** server that exposes Ethereum blockchain data over the **HTTP protocol** in **stateless mode**.

It is built using:

- [ethers.js](https://docs.ethers.org/) → blockchain interaction
- [Model Context Protocol SDK](https://github.com/modelcontextprotocol/typescript-sdk) → MCP server implementation
- [Express.js](https://expressjs.com/) → HTTP transport

---

## 🚀 What this server does

The server exposes Ethereum blockchain data as **MCP tools**.  
Each tool corresponds to a JSON-RPC style endpoint accessible via the MCP client.

It currently provides 4 tools:

1. **`getBlock`** → Fetch Ethereum block details
2. **`getLogs`** → Fetch logs from a contract within a block range
3. **`getTransaction`** → Fetch transaction details by hash
4. **`searchEvents`** → Search and decode contract events by ABI and event name

---

## Endpoints / Tools

### 1. `getBlock`

- **Input**

  ````json
  {
    "blockNumber": 18500000
  }
  ```

  ````

- **output**

```json
{
  "block": {
    "number": 18500000,
    "hash": "...",
    "transactions": [...]
  }
}
```

### 2. `getLogs`

- **input**

```json
{
  "address": "0xdAC17F958D2ee523a2206206994597C13D831ec7",
  "fromBlock": 18500000,
  "toBlock": 18500010,
  "topics": ["0xddf252ad..."]
}
```

- **output**

```json
{
  "logs": [
    {
      "blockNumber": 18500000,
      "transactionHash": "...",
      "data": "...",
      "topics": ["..."]
    }
  ]
}
```

### 3. `getTransaction`

- **input**

```json
{
  "txHash": "0xabc123..."
}
```

- **output**

```json
{
  "tx": {
    "hash": "0xabc123...",
    "from": "...",
    "to": "...",
    "value": "1000000000000000000",
    "blockNumber": 18500000
  }
}
```

### 4. searchEvents

- **input**

```json
{
  "contractAddress": "0xdAC17F958D2ee523a2206206994597C13D831ec7",
  "abi": [
    "event Transfer(address indexed from, address indexed to, uint256 value)"
  ],
  "eventName": "Transfer",
  "fromBlock": 18500000,
  "toBlock": 18500010
}
```

- **output**

```json
{
  "events": [
    {
      "from": "0x123...",
      "to": "0x456...",
      "value": "1000000"
    }
  ]
}
```

## Protocol

- Runs in HTTP mode using Express.js

- Entry point routes:

- POST /mcp → Handle MCP requests

- GET /mcp → Disabled (405 Method Not Allowed)

- DELETE /mcp → Disabled (405 Method Not Allowed)

## running the server

1. install dependency

```bash
npm install
```

2. start the server

```bash
bun run server.ts
```

it runs on the port 3000
