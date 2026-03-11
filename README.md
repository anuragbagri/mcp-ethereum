# Ethereum MCP Server

Ethereum MCP server exposing indexed blockchain data as MCP tools over either `stdio` or streamable `HTTP` transport.

## Features

- MCP tools: `getBlock`, `getTransaction`, `getLogs`, `searchEvents`
- Strict input validation (address/hash format, block range checks, page bounds)
- Configurable block-window chunking with cursor pagination metadata
- Retry + timeout controls for transient RPC failures
- Structured execution logging and normalized MCP error payloads

## Requirements

- Bun 1.3+
- Node.js 18+ (for generated build runtime)
- Ethereum JSON-RPC endpoint

## Environment Variables

Copy `.env.example` and set values:

- Required:
- `RPC_URL`: Ethereum JSON-RPC URL (must be valid `http(s)` URL)

- Optional safety/runtime settings:
- `EXPECTED_CHAIN_ID`: Fail startup if provider chain ID differs
- `RPC_REQUEST_TIMEOUT_MS`: Per-RPC timeout (default: `15000`)
- `RPC_RETRY_MAX_ATTEMPTS`: Retry attempts for transient failures (default: `3`)
- `RPC_RETRY_BASE_DELAY_MS`: Exponential backoff base delay ms (default: `300`)
- `MAX_BLOCK_WINDOW`: Max block chunk size for logs/events queries (default: `2000`)
- `MCP_TRANSPORT`: `stdio` (default) or `http`
- `PORT`: HTTP listen port in `http` mode (default: `3000`)

## Running

Install dependencies:

```bash
bun install
```

Development mode:

```bash
bun run dev
```

Production build:

```bash
bun run build
bun run start
```

## Transport Modes

### Stdio (default)

Used by local MCP hosts that spawn the process directly.

```bash
MCP_TRANSPORT=stdio bun run dev
```

### HTTP (streamable HTTP transport)

```bash
MCP_TRANSPORT=http PORT=3000 bun run dev
```

Endpoints:

- MCP endpoint: `POST|GET|DELETE /mcp`
- Health check: `GET /health` -> `{ "status": "ok" }`

## Tool Examples

### `getBlock`

Input:

```json
{ "blockNumber": 19000000 }
```

Success result shape (`structuredContent`):

```json
{
  "ok": true,
  "data": {
    "found": true,
    "block": {
      "number": 19000000,
      "hash": "0x...",
      "parentHash": "0x...",
      "timestamp": 1700000000,
      "transactionCount": 203
    }
  }
}
```

### `getLogs`

Input:

```json
{
  "address": "0xdAC17F958D2ee523a2206206994597C13D831ec7",
  "fromBlock": 19000000,
  "toBlock": 19005000,
  "pageSize": 500
}
```

Response includes continuation metadata:

```json
{
  "ok": true,
  "data": {
    "logs": [],
    "pageInfo": {
      "nextCursor": "19002000",
      "hasMore": true,
      "returned": 500,
      "maxBlockWindow": 2000,
      "pageSize": 500
    }
  }
}
```

### `searchEvents`

Input includes ABI array and event name; ABI is validated before querying.

## Testing

- Unit tests: `bun run test:unit`
- Integration tests (local emulator + MCP stdio client): `bun run test:integration`
- All tests: `bun run test`

## Operations

### Container deployment

Build image:

```bash
docker build -t mcp-ethereum:latest .
```

Run HTTP mode:

```bash
docker run --rm -p 3000:3000 \
  -e RPC_URL=https://your-rpc \
  -e EXPECTED_CHAIN_ID=1 \
  -e MCP_TRANSPORT=http \
  mcp-ethereum:latest
```

### CI checks

GitHub Actions workflow at `.github/workflows/ci.yml` runs:

- Typecheck
- Unit tests
- Integration tests
- Build

### Health checks

Use `GET /health` in HTTP mode for readiness/liveness probes.

### Rollback guidance

1. Keep previous container tags available (for example image digest pinning).
2. Roll back by redeploying prior known-good tag.
3. Validate with `/health` and a smoke MCP tool call (`getBlock`) after rollback.
