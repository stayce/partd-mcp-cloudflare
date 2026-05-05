# Open Payments MCP Server

**11 actions. $13B+ in pharma payments. One tool call.**

A Model Context Protocol (MCP) server giving AI assistants instant access to CMS Open Payments (Sunshine Act) data — every dollar pharmaceutical and medical device companies pay to physicians, deployed on Cloudflare Workers.

**Live endpoint:** `https://mcp-openpayments.medseal.app/mcp`

No API key required. Public federal data. Zero configuration.

## What Can It Do?

**Physician Payment Profiles**
Look up any physician by NPI and see every payment they've received — which companies paid them, how much, and what for. Aggregated by payer and payment type.

**Company Payment Analysis**
Search any pharmaceutical or medical device company to see who they're paying, how much, and the nature of each payment.

**Physician Search**
Find physicians by name across the Open Payments database. Results show specialties, locations, and total payment amounts.

**Top Recipients**
Rank physicians by total payments received. See who's getting the most money from industry and from whom.

**Top Payers**
Rank companies by total payments made. See which manufacturers are spending the most on physician payments.

**Payment Type Breakdown**
Analyze payments by category — Food and Beverage, Consulting Fees, Travel, Research, Royalties, and more. See what percentage each type represents.

**Specialty Analysis**
Which medical specialties receive the most industry payments? Aggregated by specialty with physician counts and totals.

**Geographic Patterns**
Payment data by state — see where industry money flows geographically.

**Dashboard Summary**
One-call overview: top companies, top recipients, payment type breakdown, and aggregate totals.

## Quick Start

Add to your Claude Desktop or Claude Code config:

```json
{
  "mcpServers": {
    "openpayments": {
      "type": "url",
      "url": "https://mcp-openpayments.medseal.app/mcp"
    }
  }
}
```

That's it. Start asking about pharma payments.

## Actions

| Action | Purpose |
|--------|---------|
| `search` | Search for physicians by name |
| `physician` | Full payment profile by NPI |
| `company` | Payments from a specific manufacturer |
| `top_recipients` | Physicians receiving the most payments |
| `top_payers` | Companies making the most payments |
| `payment_types` | Breakdown by nature of payment |
| `specialty` | Payments by physician specialty |
| `state` | Geographic breakdown |
| `summary` | Dashboard overview |
| `api` | Raw DKAN API query |
| `help` | Full documentation |

## Examples

```json
{"action": "summary"}
{"action": "physician", "npi": "1234567890"}
{"action": "company", "company": "Pfizer"}
{"action": "company", "company": "Novo Nordisk"}
{"action": "search", "name": "John Smith"}
{"action": "top_recipients", "max_results": 20}
{"action": "top_payers", "max_results": 10}
{"action": "payment_types", "nature": "Food and Beverage"}
{"action": "specialty"}
{"action": "state", "state": "CA"}
```

## Data Coverage

| Field | Details |
|-------|---------|
| Program Year | 2023 |
| Payment Type | General Payments |
| Total Records | 14.7M+ (2018-2024 combined) |
| Total Value | $13.18B (2024 program year) |
| Source | CMS Open Payments (Sunshine Act) |

Source: [openpaymentsdata.cms.gov](https://openpaymentsdata.cms.gov) — updated annually, no authentication required.

## Target Users

- **Healthcare journalists** — investigate industry influence on prescribing
- **Health policy analysts** — track pharma spending patterns
- **Compliance officers** — monitor physician-industry relationships
- **Researchers** — study payment patterns by specialty, geography, company
- **AI/LLM builders** — give your agents pharma payment intelligence
- **Patients** — check if your doctor receives industry payments

## Key Advantages

- **No API key** — public federal data, zero configuration
- **Token efficient** — single tool with action dispatch, LLMs learn one schema
- **Sub-50ms latency** — Cloudflare Workers edge network
- **Aggregated insights** — not just raw records: profiles, rankings, breakdowns
- **Cross-referenceable** — same NPIs as Medicare Part D prescriber data

## Deploy Your Own

```bash
git clone https://github.com/stayce/open-payments-mcp-cloudflare
cd open-payments-mcp-cloudflare
npm install
npm run deploy
```

No secrets needed. No environment variables. Just deploy.

## MedSeal MCP Suite

Part of a growing collection of healthcare MCP servers:

| Server | Data | Actions | Live |
|--------|------|---------|------|
| **[open-payments-mcp](https://github.com/stayce/open-payments-mcp-cloudflare)** | CMS Open Payments (Sunshine Act) | 11 | [mcp-openpayments.medseal.app/mcp](https://mcp-openpayments.medseal.app/mcp) |
| **[partd-mcp](https://github.com/stayce/partd-mcp-cloudflare)** | Medicare Part D spending & prescribers | 15 | [mcp-partd.medseal.app/mcp](https://mcp-partd.medseal.app/mcp) |
| **[icd-mcp](https://github.com/stayce/icd-mcp-cloudflare)** | WHO ICD-10 & ICD-11 codes | 12 | [mcp-icd.medseal.app/mcp](https://mcp-icd.medseal.app/mcp) |
| **[icf-mcp](https://github.com/stayce/icf-mcp-cloudflare)** | WHO ICF functioning codes | 6 | [mcp-icf.medseal.app/mcp](https://mcp-icf.medseal.app/mcp) |

**Together:** diagnosis codes, functioning classification, drug spending, prescriber data, and industry payments — all accessible to any MCP-compatible AI assistant.

**Power combo:** Use **Open Payments + Part D** together to answer questions like _"Does this doctor prescribe a lot of Ozempic AND receive payments from Novo Nordisk?"_

## License

MIT
