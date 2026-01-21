# Medicare Part D MCP Server (Cloudflare Workers)

A Model Context Protocol (MCP) server for **CMS Medicare Part D** drug spending and prescriber data, deployed on Cloudflare Workers.

**Live URL:** `https://partd-mcp-server.staycek.workers.dev/mcp`

## Features

- Drug spending data (2024 quarterly, 2019-2023 annual)
- Prescriber lookup by drug or NPI
- Top drugs by Medicare spending
- No API key required (public CMS data)
- Single tool with 7 actions (token efficient)

## Data Coverage

| Dataset | Period | Updated |
|---------|--------|---------|
| Quarterly Spending | 2024 Q1-Q4 | Dec 2025 |
| Annual Spending | 2019-2023 | May 2025 |
| Prescriber Data | 2022 | Sep 2025 |

## Actions

| Action | Purpose |
|--------|---------|
| `drug` | Get drug spending details |
| `spending` | Full spending analysis with trends |
| `prescribers` | Find prescribers by drug or NPI |
| `top` | Top drugs by total spending |
| `search` | Search drugs by name |
| `api` | Raw CMS Data API |
| `help` | Documentation |

## Usage with Claude

Add to your Claude Desktop config:

```json
{
  "mcpServers": {
    "partd": {
      "type": "http",
      "url": "https://partd-mcp-server.staycek.workers.dev/mcp"
    }
  }
}
```

## Examples

```json
{"action": "drug", "drug": "Ozempic"}
{"action": "drug", "drug": "Eliquis", "dataset": "annual"}
{"action": "spending", "drug": "Humira"}
{"action": "prescribers", "drug": "Ozempic", "state": "CA"}
{"action": "prescribers", "npi": "1234567890"}
{"action": "top", "max_results": 20}
{"action": "search", "query": "insulin"}
{"action": "api", "dataset": "quarterly", "query": "metformin"}
{"action": "help"}
```

## Deploy Your Own

1. Clone and install:
   ```bash
   git clone https://github.com/stayce/partd-mcp-cloudflare
   cd partd-mcp-cloudflare
   npm install
   ```

2. Deploy:
   ```bash
   npm run deploy
   ```

No secrets needed - CMS data is public.

## Related

- [icd-mcp-cloudflare](https://github.com/stayce/icd-mcp-cloudflare) - WHO ICD-10/ICD-11 MCP
- [icf-mcp-cloudflare](https://github.com/stayce/icf-mcp-cloudflare) - WHO ICF MCP
- [streamshortcut-cloudflare](https://github.com/stayce/streamshortcut-cloudflare) - Shortcut MCP

## Data Source

All data from [CMS data.cms.gov](https://data.cms.gov):
- [Medicare Part D Spending Dashboard](https://data.cms.gov/tools/medicare-part-d-drug-spending-dashboard)
- [Part D Prescribers](https://data.cms.gov/provider-summary-by-type-of-service/medicare-part-d-prescribers)

## License

MIT
