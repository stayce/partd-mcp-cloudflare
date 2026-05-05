# CLAUDE.md

## Project Overview

Open Payments MCP Server — a Model Context Protocol (MCP) server for CMS Open Payments (Sunshine Act) data, deployed on Cloudflare Workers. Queries public federal data on pharmaceutical and medical device company payments to physicians (no API key required).

**Live endpoint:** `https://mcp-openpayments.medseal.app/mcp`

## Tech Stack

- **Runtime:** Cloudflare Workers (serverless edge)
- **Language:** TypeScript 5.7 (target ES2022, strict mode)
- **MCP SDK:** `@modelcontextprotocol/sdk` v1.0.0 with `agents` library for Cloudflare Workers integration
- **Validation:** Zod v3.22
- **Build/Deploy:** Wrangler CLI (esbuild under the hood, no explicit build step)

## Commands

```bash
npm run dev       # Local dev server (wrangler dev)
npm run deploy    # Deploy to Cloudflare Workers (wrangler deploy)
npm install       # Install dependencies
```

There is no test framework configured. No linter or formatter is configured.

## Project Structure

```
src/
  index.ts      # Worker entry point, MCP server setup, route handling
  types.ts      # Type definitions, Zod schema, dataset identifiers
  handlers.ts   # Action dispatcher + 11 action handlers + formatting utils
  client.ts     # OpenPaymentsClient class wrapping DKAN API calls
```

Four files total. No subdirectories, no test files.

## Architecture

### Single-Tool, Action-Dispatch Pattern

The server exposes one MCP tool named `openpayments` with an `action` parameter that dispatches to 11 handlers. This is intentional for token efficiency — LLMs only need to learn one tool schema.

**Actions:** `search`, `physician`, `company`, `top_recipients`, `top_payers`, `payment_types`, `specialty`, `state`, `summary`, `api`, `help`

### Request Flow

1. `index.ts` — Cloudflare Worker `fetch` handler routes `/mcp` to the MCP handler, `/health` and `/` to health check
2. `index.ts` — `createServer()` registers the `openpayments` tool with Zod schema validation
3. `handlers.ts` — `handleAction()` switch-dispatches to the appropriate handler
4. `client.ts` — `OpenPaymentsClient` methods call the DKAN API at `openpaymentsdata.cms.gov`

### API: DKAN (not data.cms.gov)

Open Payments uses a DKAN-based API at `openpaymentsdata.cms.gov`, NOT the `data.cms.gov/data-api/v1/dataset` pattern used by Part D. Key differences:

- **Endpoint:** `POST /api/1/datastore/query/{datasetId}/0`
- **Query format:** JSON body with `conditions`, `sorts`, `limit`, `offset`
- **Conditions:** `{resource: "t", property: "field_name", value: "...", operator: "="|"LIKE"}`
- **Max records:** 500 per request (pagination via `offset`)
- **Field names:** lowercase with underscores (e.g., `covered_recipient_npi`, `total_amount_of_payment_usdollars`)

### Key Design Decisions

- **New server per request:** `createServer()` is called on every `/mcp` request (stateless Workers pattern)
- **Aggregation in handlers:** Raw API returns individual payment records; handlers aggregate by physician, company, specialty, state, and payment type
- **Markdown output:** All tool responses are formatted as markdown tables for LLM readability
- **Error convention:** Errors return `{ content: [...], isError: true }`; try-catch wraps the entire dispatcher

## Key Files Reference

| File | Key Exports | Lines |
|------|-------------|-------|
| `src/index.ts` | Default Worker fetch handler, Cache-Control headers | ~95 |
| `src/types.ts` | `OpenPaymentsParams` (Zod schema), `DATASETS` (identifiers), `GeneralPayment` interface | ~90 |
| `src/handlers.ts` | `handleAction()`, 11 action handlers, formatting utilities | ~530+ |
| `src/client.ts` | `OpenPaymentsClient` class (DKAN API interactions) | ~190 |

## Open Payments Data

- **API Base:** `https://openpaymentsdata.cms.gov/api/1/datastore/query/{datasetId}/0`
- **No auth required** — public Sunshine Act data
- **Dataset identifiers** are in `src/types.ts` (`DATASETS` object)
- **Current dataset:** 2023 General Payment Data (`fb3a65aa-c901-4a38-a813-b04b00dfa2a9`)
- **Key fields:** `covered_recipient_npi`, `covered_recipient_first_name`, `covered_recipient_last_name`, `covered_recipient_specialty_1`, `applicable_manufacturer_or_applicable_gpo_making_payment_name`, `total_amount_of_payment_usdollars`, `nature_of_payment_or_transfer_of_value`
- **Update frequency:** Annually (June publication, January refresh)

## Deployment

- **Environments:** `dev` and `production` (defined in `wrangler.toml`)
- **Production domain:** `mcp-openpayments.medseal.app`
- **No secrets or environment variables needed**
- Node.js compatibility flag is enabled
- Observability is enabled

## Code Conventions

- `camelCase` for functions and variables
- `PascalCase` for types, interfaces, and classes
- DKAN API field names are lowercase with underscores (e.g., `covered_recipient_npi`)
- Action names are lowercase strings (with underscores for multi-word: `top_recipients`)
- Handlers are standalone async functions, not class methods
- `OpenPaymentsClient` is a class with a private `query()` method for DKAN API calls
- Currency formatting: human-readable ($1.5B, $123M, $45K)
- No external state or database — pure API proxy with aggregation and formatting
