# Medicare Part D MCP Server

**15 actions. $200B+ in drug spending data. One tool call.**

A Model Context Protocol (MCP) server giving AI assistants instant access to CMS Medicare Part D drug spending, prescriber, and pricing trend data — deployed on Cloudflare Workers with sub-50ms global response times.

**Live endpoint:** `https://mcp-partd.medseal.app/mcp`

No API key required. Public CMS data. Zero configuration.

## What Can It Do?

**Spending Analysis**
Get current quarterly spending or full multi-year trend analysis for any Part D drug. Covers 2024 Q1-Q4 quarterly data and 2019-2023 annual trends.

**Drug Comparison**
Compare two drugs side-by-side: total spending, beneficiaries, cost per claim, year-over-year changes, and 4-year CAGR — all in one call.

**Price Outlier Detection**
Surface drugs with the biggest price increases or decreases. Filter by risers, fallers, or both. Powered by CMS year-over-year change data.

**Generic Alternative Finder**
Given any brand-name drug, find all drugs sharing the same generic compound and compare costs per beneficiary. Shows potential savings percentage.

**Prescriber Intelligence**
Look up who prescribes what — by drug name, by state, or by NPI. Aggregate prescribing data with top drugs per provider.

**Specialty Breakdown**
See which medical specialties prescribe a drug the most. Aggregated by provider type with claim counts and cost totals.

**Geographic Patterns**
Prescribing data broken down by state — see where drugs are prescribed most heavily across the US.

**Manufacturer Portfolio**
Look up any drug manufacturer to see their full Part D portfolio: all drugs, combined spending, beneficiary counts.

**Dashboard Summary**
One-call overview of the entire Part D landscape: top drugs by spending, most prescribed by beneficiaries, biggest price movers.

**Top Rankings**
Rank drugs by spending, beneficiaries, or claims. Sortable. Configurable result count.

## Quick Start

Add to your Claude Desktop or Claude Code config:

```json
{
  "mcpServers": {
    "partd": {
      "type": "url",
      "url": "https://mcp-partd.medseal.app/mcp"
    }
  }
}
```

That's it. Start asking about drug spending.

## Actions

| Action | Purpose |
|--------|---------|
| `drug` | Get drug spending details (quarterly or annual) |
| `spending` | Full spending analysis with current + trend data |
| `compare` | Side-by-side comparison of two drugs |
| `outliers` | Drugs with biggest price increases/decreases |
| `generics` | Find generic alternatives, compare costs |
| `specialty` | Prescribing patterns by provider specialty |
| `prescribers` | Find prescribers by drug, state, or NPI |
| `geography` | Prescribing patterns by state/region |
| `manufacturer` | All drugs by a manufacturer |
| `top` | Top drugs by spending, beneficiaries, or claims |
| `search` | Search drugs by name |
| `summary` | Dashboard overview of Part D landscape |
| `stats` | Dataset metadata and statistics |
| `api` | Raw CMS Data API escape valve |
| `help` | Full documentation |

## Examples

```json
{"action": "summary"}
{"action": "compare", "drug": "Ozempic", "drug2": "Mounjaro"}
{"action": "outliers", "direction": "risers", "max_results": 10}
{"action": "generics", "drug": "Humira"}
{"action": "specialty", "drug": "Eliquis"}
{"action": "spending", "drug": "Ozempic"}
{"action": "prescribers", "drug": "Ozempic", "state": "CA"}
{"action": "geography", "drug": "Eliquis"}
{"action": "manufacturer", "manufacturer": "Eli Lilly"}
{"action": "top", "sort": "beneficiaries", "max_results": 20}
{"action": "search", "query": "insulin"}
{"action": "drug", "drug": "Eliquis", "dataset": "annual"}
```

## Data Coverage

| Dataset | Period | Records |
|---------|--------|---------|
| Quarterly Spending | 2024 Q1-Q4 | All Part D drugs |
| Annual Spending Trends | 2019-2023 | YoY + 4-year CAGR |
| Prescriber by Drug | 2022 | Provider-level claims |
| Prescriber by Provider | 2022 | Full provider profiles |
| Prescriber by Geography | 2022 | State-level aggregates |

Source: [CMS data.cms.gov](https://data.cms.gov) — updated quarterly, no authentication required.

## Target Users

- **Health policy analysts** — track drug spending trends, identify cost outliers
- **Healthcare journalists** — investigate pricing patterns, manufacturer portfolios
- **Pharmacy benefit managers** — compare drug costs, find generic alternatives
- **Health IT developers** — integrate Medicare spending data into applications
- **AI/LLM builders** — give your agents Medicare drug intelligence
- **Researchers** — prescribing patterns by specialty, geography, provider

## Key Advantages

- **No API key** — public CMS data, zero configuration
- **Token efficient** — single tool with action dispatch, LLMs learn one schema
- **Sub-50ms latency** — Cloudflare Workers edge network, global deployment
- **Analytical depth** — not just lookups: comparisons, outlier detection, savings analysis
- **5 CMS datasets** — spending, trends, prescribers, providers, geography
- **Always current** — CMS quarterly updates, 1-hour edge caching

## Deploy Your Own

```bash
git clone https://github.com/stayce/partd-mcp-cloudflare
cd partd-mcp-cloudflare
npm install
npm run deploy
```

No secrets needed. No environment variables. Just deploy.

## MedSeal MCP Suite

Part of a growing collection of healthcare MCP servers:

| Server | Data | Actions | Live |
|--------|------|---------|------|
| **[partd-mcp](https://github.com/stayce/partd-mcp-cloudflare)** | Medicare Part D spending & prescribers | 15 | [mcp-partd.medseal.app/mcp](https://mcp-partd.medseal.app/mcp) |
| **[icd-mcp](https://github.com/stayce/icd-mcp-cloudflare)** | WHO ICD-10 & ICD-11 codes | 12 | [mcp-icd.medseal.app/mcp](https://mcp-icd.medseal.app/mcp) |
| **[icf-mcp](https://github.com/stayce/icf-mcp-cloudflare)** | WHO ICF functioning codes | 6 | [mcp-icf.medseal.app/mcp](https://mcp-icf.medseal.app/mcp) |

Together: diagnosis codes, functioning classification, drug spending, and prescriber data — all accessible to any MCP-compatible AI assistant.

## License

MIT
