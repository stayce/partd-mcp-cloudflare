# CLAUDE.md

## Project Overview

Drug Reference MCP Server — a unified drug intelligence MCP server combining RxNorm, FDA FAERS, NDC Directory, Drug Labels, and Recall data. Deployed on Cloudflare Workers. All APIs are free and public (no keys required).

**Live endpoint:** `https://mcp-drug.medseal.app/mcp`

## Tech Stack

- **Runtime:** Cloudflare Workers (serverless edge)
- **Language:** TypeScript 5.7 (target ES2022, strict mode)
- **MCP SDK:** `@modelcontextprotocol/sdk` v1.0.0 with `agents` library
- **Validation:** Zod v3.22
- **Build/Deploy:** Wrangler CLI

## Commands

```bash
npm run dev       # Local dev server (wrangler dev)
npm run deploy    # Deploy to Cloudflare Workers
npm install       # Install dependencies
```

No test framework, linter, or formatter configured.

## Project Structure

```
src/
  index.ts      # Worker entry point, MCP server setup
  types.ts      # Type definitions, Zod schema, API base URLs
  handlers.ts   # Action dispatcher + 9 action handlers
  client.ts     # DrugClient class — multi-source API client
```

## Architecture

### Single-Tool, Action-Dispatch Pattern

One MCP tool named `drug` with 9 actions: `search`, `ndc`, `adverse_events`, `label`, `recalls`, `rxnorm`, `crossref`, `api`, `help`

### Multi-Source Client

Unlike Part D (one API) or Open Payments (one API), this server queries **five different APIs** from two providers:

| Source | Base URL | Method |
|--------|----------|--------|
| RxNorm | `rxnav.nlm.nih.gov/REST` | GET, JSON |
| openFDA FAERS | `api.fda.gov/drug/event.json` | GET with search + count params |
| openFDA NDC | `api.fda.gov/drug/ndc.json` | GET with search param |
| openFDA Labels | `api.fda.gov/drug/label.json` | GET with search param |
| openFDA Recalls | `api.fda.gov/drug/enforcement.json` | GET with search param |

### Key Design Decisions

- **`crossref` is the headline action** — fetches all 5 sources in parallel with `Promise.all`, returns unified profile
- **Fallback searches:** When brand name search fails, handlers retry with generic name
- **Text truncation:** Label text is truncated to prevent token bloat (configurable via `truncate()`)
- **openFDA `count` endpoint:** Used for adverse events instead of raw records — returns top N reactions directly
- **Seriousness breakdown:** Four parallel FAERS queries (total, serious, death, hospitalization) for the overview

### openFDA Query Syntax

```
search=field.exact:"value"      # Exact match
search=field:"value"            # Contains
&count=field.exact              # Count unique values
&limit=N                        # Max results (1000 for search, unlimited for count)
&sort=field:desc                # Sort order
```

The `.exact` suffix is required for `count` queries to count full phrases rather than individual words.

## Key Files Reference

| File | Key Exports | Lines |
|------|-------------|-------|
| `src/index.ts` | Default Worker fetch handler | ~80 |
| `src/types.ts` | `DrugParams` (Zod), API types for RxNorm + openFDA | ~130 |
| `src/handlers.ts` | `handleAction()`, 9 handlers including `crossref` | ~500+ |
| `src/client.ts` | `DrugClient` class (RxNorm + openFDA methods) | ~200 |

## Code Conventions

- Same conventions as Part D and Open Payments servers
- `camelCase` for functions/variables, `PascalCase` for types/classes
- openFDA field names use lowercase with underscores/dots (e.g., `patient.drug.openfda.brand_name`)
- RxNorm field names use camelCase (e.g., `rxcui`, `conceptProperties`)
- All handlers return markdown-formatted text for LLM readability
