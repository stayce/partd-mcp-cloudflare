# Drug Reference MCP Server

**9 actions. 5 federal APIs. One tool call.**

A unified drug intelligence MCP server that stitches together RxNorm, FDA adverse events, NDC codes, drug labels, and recall data into a single tool — deployed on Cloudflare Workers.

**Live endpoint:** `https://mcp-drug.medseal.app/mcp`

No API key required. Five federal data sources. Zero configuration.

## The Crossref Action

The headline feature: **one call that pulls from all five sources simultaneously.**

```json
{"action": "crossref", "drug": "Ozempic"}
```

Returns: drug identity (RxNorm), product info (NDC), prescribing highlights (labels), adverse event summary (FAERS), and recall status — all in a single response.

You can also crossref by NDC code:
```json
{"action": "crossref", "ndc": "0169-4130-12"}
```

## What Can It Do?

**Drug Search (RxNorm)**
Find any drug by name — returns RxCUI identifiers, brand/generic mappings, ingredients, dose forms, and all associated NDC codes.

**Adverse Event Analysis (FDA FAERS)**
Top reported reactions for any drug, plus seriousness breakdown: total reports, serious events, hospitalizations, and deaths. Powered by the FDA Adverse Event Reporting System.

**Drug Labels (FDA SPL)**
Full prescribing information: indications, boxed warnings, contraindications, dosage, drug interactions, and adverse reactions from the label.

**NDC Product Lookup (FDA)**
Product details by NDC code or drug name: manufacturer, dosage form, route, active ingredients and strengths, and packaging.

**Recall Data (FDA)**
Active and historical recalls: classification (I/II/III), reason, recalling firm, status, and product description.

**RxNorm Deep Dive**
Full concept graph for any RxCUI: ingredients, brand names, clinical drugs, dose forms, and all associated NDC codes.

## Quick Start

```json
{
  "mcpServers": {
    "drug": {
      "type": "url",
      "url": "https://mcp-drug.medseal.app/mcp"
    }
  }
}
```

## Actions

| Action | Source | Purpose |
|--------|--------|---------|
| `search` | RxNorm | Find drugs by name |
| `ndc` | openFDA | NDC product lookup |
| `adverse_events` | openFDA FAERS | Top reactions + seriousness |
| `label` | openFDA Labels | Prescribing information |
| `recalls` | openFDA Enforcement | Recall/enforcement data |
| `rxnorm` | RxNorm | Full concept details + NDC codes |
| `crossref` | All 5 sources | Complete drug profile in one call |
| `api` | Any | Raw API response |
| `help` | — | Documentation |

## Examples

```json
{"action": "crossref", "drug": "Ozempic"}
{"action": "crossref", "ndc": "0169-4130-12"}
{"action": "adverse_events", "drug": "Eliquis"}
{"action": "label", "drug": "Humira"}
{"action": "recalls", "drug": "metformin"}
{"action": "search", "drug": "semaglutide"}
{"action": "rxnorm", "rxcui": "2551560"}
{"action": "ndc", "drug": "Lipitor"}
```

## Data Sources

| Source | API | No Auth | Data |
|--------|-----|---------|------|
| NLM RxNorm | rxnav.nlm.nih.gov/REST | Yes | Drug identity, NDC mapping, ingredients |
| FDA FAERS | api.fda.gov/drug/event.json | Yes | Adverse event reports (millions) |
| FDA NDC | api.fda.gov/drug/ndc.json | Yes | Product info, manufacturers |
| FDA Labels | api.fda.gov/drug/label.json | Yes | Prescribing information (SPL) |
| FDA Recalls | api.fda.gov/drug/enforcement.json | Yes | Recall/enforcement actions |

## Target Users

- **Pharmacovigilance teams** — adverse event analysis and signal detection
- **Clinical decision support** — drug info, interactions, contraindications
- **Healthcare journalists** — recall investigations, safety profiles
- **Pharmacy systems** — NDC lookups, product verification
- **AI/LLM builders** — give your agents comprehensive drug intelligence
- **Researchers** — cross-reference drug identity with safety data

## Key Advantages

- **Five sources, one call** — crossref stitches RxNorm + FAERS + NDC + Labels + Recalls
- **NDC as the bridge** — connects drug identity to safety to product info
- **No API key** — all federal APIs are free and public
- **Token efficient** — single tool, action dispatch
- **Sub-50ms latency** — Cloudflare Workers edge network

## Deploy Your Own

```bash
git clone https://github.com/stayce/drug-mcp-cloudflare
cd drug-mcp-cloudflare
npm install
npm run deploy
```

## MedSeal MCP Suite

| Server | Data | Actions | Live |
|--------|------|---------|------|
| **[drug-mcp](https://github.com/stayce/drug-mcp-cloudflare)** | RxNorm + openFDA (FAERS, NDC, Labels, Recalls) | 9 | [mcp-drug.medseal.app/mcp](https://mcp-drug.medseal.app/mcp) |
| **[open-payments-mcp](https://github.com/stayce/open-payments-mcp-cloudflare)** | CMS Open Payments (Sunshine Act) | 11 | [mcp-openpayments.medseal.app/mcp](https://mcp-openpayments.medseal.app/mcp) |
| **[partd-mcp](https://github.com/stayce/partd-mcp-cloudflare)** | Medicare Part D spending & prescribers | 15 | [mcp-partd.medseal.app/mcp](https://mcp-partd.medseal.app/mcp) |
| **[icd-mcp](https://github.com/stayce/icd-mcp-cloudflare)** | WHO ICD-10 & ICD-11 codes | 12 | [mcp-icd.medseal.app/mcp](https://mcp-icd.medseal.app/mcp) |
| **[icf-mcp](https://github.com/stayce/icf-mcp-cloudflare)** | WHO ICF functioning codes | 6 | [mcp-icf.medseal.app/mcp](https://mcp-icf.medseal.app/mcp) |

**Power combos:**
- **Drug + Part D:** "What are Ozempic's adverse events AND how much does Medicare spend on it?"
- **Drug + Open Payments:** "Look up this drug's safety profile AND which companies pay doctors to prescribe it"
- **Drug + ICD:** "What's the ICD-10 code for diabetes AND what are the adverse events for metformin?"

## License

MIT
