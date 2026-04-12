# CLAUDE.md

## Project Overview

Medicare Part D MCP Server — a Model Context Protocol (MCP) server for CMS Medicare Part D drug spending and prescriber data, deployed on Cloudflare Workers. Queries public CMS data (no API key required).

**Live endpoint:** `https://mcp-partd.medseal.app/mcp`

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
  types.ts      # Type definitions, Zod schema, CMS dataset UUIDs
  handlers.ts   # Action dispatcher + 15 action handlers + formatting utils
  client.ts     # CMSClient class wrapping CMS Data API calls
```

Four files total. No subdirectories, no test files.

## Architecture

### Single-Tool, Action-Dispatch Pattern

The server exposes one MCP tool named `partd` with an `action` parameter that dispatches to 15 handlers. This is intentional for token efficiency — LLMs only need to learn one tool schema.

**Actions:** `drug`, `spending`, `prescribers`, `top`, `search`, `compare`, `geography`, `manufacturer`, `stats`, `outliers`, `generics`, `specialty`, `summary`, `api`, `help`

### Request Flow

1. `index.ts` — Cloudflare Worker `fetch` handler routes `/mcp` to the MCP handler, `/health` and `/` to health check
2. `index.ts` — `createServer()` registers the `partd` tool with Zod schema validation
3. `handlers.ts` — `handleAction()` switch-dispatches to the appropriate handler
4. `client.ts` — `CMSClient` methods call `https://data.cms.gov/data-api/v1/dataset/{uuid}/data`

### Key Design Decisions

- **New server per request:** `createServer()` is called on every `/mcp` request (stateless Workers pattern)
- **"Overall" filtering:** CMS data includes per-manufacturer rows; handlers filter for `Mftr_Name === "Overall"` to get aggregate data
- **Markdown output:** All tool responses are formatted as markdown text (tables, headers, bold) for LLM readability
- **Error convention:** Errors return `{ content: [...], isError: true }`; try-catch wraps the entire dispatcher

## Key Files Reference

| File | Key Exports | Lines |
|------|-------------|-------|
| `src/index.ts` | Default Worker fetch handler, Cache-Control headers | ~97 |
| `src/types.ts` | `PartDParams` (Zod schema), `DATASETS` (UUID constants), CMS response interfaces | ~120 |
| `src/handlers.ts` | `handleAction()`, 15 action handlers, formatting utilities | ~950+ |
| `src/client.ts` | `CMSClient` class (all CMS API interactions) | ~285 |

## CMS Data API

- **Base URL:** `https://data.cms.gov/data-api/v1/dataset/{datasetId}/data`
- **No auth required** — public Medicare data
- **Dataset UUIDs** are constants in `src/types.ts` (`DATASETS` object)
- **Datasets:** quarterly spending (2024 Q1-Q4), annual spending trends (2019-2023), prescriber by drug (2022), prescriber by provider (2022), prescriber by geography (2022)
- CMS field names use CMS conventions (e.g., `Brnd_Name`, `Gnrc_Name`, `Tot_Spndng`, `Prscrbr_NPI`)

## Deployment

- **Environments:** `dev` and `production` (defined in `wrangler.toml`)
- **Production domain:** `mcp-partd.medseal.app`
- **No secrets or environment variables needed**
- Node.js compatibility flag is enabled
- Observability is enabled

## Code Conventions

- `camelCase` for functions and variables
- `PascalCase` for types, interfaces, and classes
- CMS API field names are preserved as-is from the API (PascalCase with underscores, e.g., `Brnd_Name`)
- Action names are lowercase strings
- Handlers are standalone async functions, not class methods
- `CMSClient` is a class with a private generic `request<T>()` method
- Currency formatting: human-readable ($1.5B, $123M, $45K)
- No external state or database — pure API proxy with formatting
