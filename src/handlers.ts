/**
 * Medicare Part D MCP Server - Action Handlers
 */

import { CMSClient } from "./client";
import {
  ToolResult,
  PartDParamsType,
  DrugSpendingQuarterly,
  DrugSpendingAnnual,
  PrescriberByDrug,
  DATASETS,
} from "./types";

/**
 * Format currency
 */
function formatCurrency(value: string | number): string {
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (num >= 1_000_000_000) {
    return `$${(num / 1_000_000_000).toFixed(2)}B`;
  } else if (num >= 1_000_000) {
    return `$${(num / 1_000_000).toFixed(2)}M`;
  } else if (num >= 1_000) {
    return `$${(num / 1_000).toFixed(2)}K`;
  }
  return `$${num.toFixed(2)}`;
}

/**
 * Format drug spending (quarterly)
 */
function formatDrugQuarterly(drug: DrugSpendingQuarterly): string {
  const lines: string[] = [
    `**${drug.Brnd_Name}** (${drug.Gnrc_Name})`,
    `Manufacturer: ${drug.Mftr_Name}`,
    `Period: ${drug.Year}`,
    "",
    `| Metric | Value |`,
    `|--------|-------|`,
    `| Total Spending | ${formatCurrency(drug.Tot_Spndng)} |`,
    `| Beneficiaries | ${parseInt(drug.Tot_Benes).toLocaleString()} |`,
    `| Claims | ${parseInt(drug.Tot_Clms).toLocaleString()} |`,
    `| Avg/Beneficiary | ${formatCurrency(drug.Avg_Spnd_Per_Bene)} |`,
    `| Avg/Claim | ${formatCurrency(drug.Avg_Spnd_Per_Clm)} |`,
  ];

  // Add drug uses if available and not "not available"
  if (drug.Drug_Uses && !drug.Drug_Uses.includes("not available")) {
    // Clean up the drug uses text
    let uses = drug.Drug_Uses.replace(/^"|"$/g, "").replace(/USES:\s*/i, "");
    // Truncate if too long
    if (uses.length > 500) {
      uses = uses.substring(0, 500) + "...";
    }
    lines.push("", `**Uses:** ${uses}`);
  }

  return lines.join("\n");
}

/**
 * Format drug spending (annual with trends)
 */
function formatDrugAnnual(drug: DrugSpendingAnnual): string {
  const lines: string[] = [
    `**${drug.Brnd_Name}** (${drug.Gnrc_Name})`,
    `Manufacturer: ${drug.Mftr_Name}`,
    "",
    `**2023 Data:**`,
    `- Total Spending: ${formatCurrency(drug.Tot_Spndng_2023)}`,
    `- Beneficiaries: ${parseInt(drug.Tot_Benes_2023).toLocaleString()}`,
    `- Avg/Beneficiary: ${formatCurrency(drug.Avg_Spnd_Per_Bene_2023)}`,
  ];

  // Add trend data if available
  if (drug.Chg_Avg_Spnd_Per_Dsg_Unt_22_23) {
    const change = parseFloat(drug.Chg_Avg_Spnd_Per_Dsg_Unt_22_23) * 100;
    lines.push(`- YoY Change (2022-2023): ${change >= 0 ? "+" : ""}${change.toFixed(1)}%`);
  }

  if (drug.CAGR_Avg_Spnd_Per_Dsg_Unt_19_23) {
    const cagr = parseFloat(drug.CAGR_Avg_Spnd_Per_Dsg_Unt_19_23) * 100;
    lines.push(`- 4-Year CAGR (2019-2023): ${cagr >= 0 ? "+" : ""}${cagr.toFixed(1)}%`);
  }

  return lines.join("\n");
}

/**
 * Format prescriber data
 */
function formatPrescriber(p: PrescriberByDrug): string {
  const name = p.Prscrbr_First_Name
    ? `${p.Prscrbr_First_Name} ${p.Prscrbr_Last_Org_Name}`
    : p.Prscrbr_Last_Org_Name;

  return [
    `**${name}** (NPI: ${p.Prscrbr_NPI})`,
    `${p.Prscrbr_Type} - ${p.Prscrbr_City}, ${p.Prscrbr_State_Abrvtn}`,
    `Drug: ${p.Brnd_Name} (${p.Gnrc_Name})`,
    `Claims: ${p.Tot_Clms} | Cost: ${formatCurrency(p.Tot_Drug_Cst)} | Days Supply: ${p.Tot_Day_Suply}`,
  ].join("\n");
}

/**
 * Main action dispatcher
 */
export async function handleAction(
  params: PartDParamsType,
  client: CMSClient
): Promise<ToolResult> {
  try {
    switch (params.action) {
      case "drug":
        return await handleDrug(params, client);

      case "spending":
        return await handleSpending(params, client);

      case "prescribers":
        return await handlePrescribers(params, client);

      case "top":
        return await handleTop(params, client);

      case "search":
        return await handleSearch(params, client);

      case "api":
        return await handleApi(params, client);

      case "help":
        return handleHelp();

      default:
        return {
          content: [{ type: "text", text: `Unknown action: ${params.action}` }],
          isError: true,
        };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: "text", text: `Error: ${message}` }],
      isError: true,
    };
  }
}

async function handleDrug(
  params: PartDParamsType,
  client: CMSClient
): Promise<ToolResult> {
  const drugName = params.drug || params.query;
  if (!drugName) {
    return {
      content: [{ type: "text", text: "drug or query parameter required" }],
      isError: true,
    };
  }

  const dataset = params.dataset || "quarterly";

  if (dataset === "annual") {
    const results = await client.getDrugSpendingAnnual(drugName);
    if (results.length === 0) {
      return {
        content: [{ type: "text", text: `No annual data found for '${drugName}'` }],
      };
    }

    // Get the "Overall" entry
    const overall = results.find((d) => d.Mftr_Name === "Overall") || results[0];
    return {
      content: [{ type: "text", text: formatDrugAnnual(overall) }],
    };
  }

  // Default: quarterly
  const results = await client.getDrugSpendingQuarterly(drugName);
  if (results.length === 0) {
    return {
      content: [{ type: "text", text: `No quarterly data found for '${drugName}'` }],
    };
  }

  // Get the "Overall" entry
  const overall = results.find((d) => d.Mftr_Name === "Overall") || results[0];
  return {
    content: [{ type: "text", text: formatDrugQuarterly(overall) }],
  };
}

async function handleSpending(
  params: PartDParamsType,
  client: CMSClient
): Promise<ToolResult> {
  const drugName = params.drug || params.query;
  if (!drugName) {
    return {
      content: [{ type: "text", text: "drug or query parameter required for spending" }],
      isError: true,
    };
  }

  // Get both quarterly and annual data
  const [quarterly, annual] = await Promise.all([
    client.getDrugSpendingQuarterly(drugName),
    client.getDrugSpendingAnnual(drugName),
  ]);

  const lines: string[] = [`# Spending Analysis: ${drugName}\n`];

  if (quarterly.length > 0) {
    const q = quarterly.find((d) => d.Mftr_Name === "Overall") || quarterly[0];
    lines.push("## Current (2024 Q1-Q4)\n");
    lines.push(formatDrugQuarterly(q));
  }

  if (annual.length > 0) {
    const a = annual.find((d) => d.Mftr_Name === "Overall") || annual[0];
    lines.push("\n## Historical Trends\n");
    lines.push(formatDrugAnnual(a));
  }

  if (quarterly.length === 0 && annual.length === 0) {
    return {
      content: [{ type: "text", text: `No spending data found for '${drugName}'` }],
    };
  }

  return {
    content: [{ type: "text", text: lines.join("\n") }],
  };
}

async function handlePrescribers(
  params: PartDParamsType,
  client: CMSClient
): Promise<ToolResult> {
  // Search by NPI
  if (params.npi) {
    const results = await client.getPrescriberByNPI(params.npi);
    if (results.length === 0) {
      return {
        content: [{ type: "text", text: `No prescriber found with NPI ${params.npi}` }],
      };
    }

    const lines = [`# Prescriber NPI: ${params.npi}\n`];
    const provider = results[0];
    const name = provider.Prscrbr_First_Name
      ? `${provider.Prscrbr_First_Name} ${provider.Prscrbr_Last_Org_Name}`
      : provider.Prscrbr_Last_Org_Name;
    lines.push(`**${name}**`);
    lines.push(`${provider.Prscrbr_Type} - ${provider.Prscrbr_City}, ${provider.Prscrbr_State_Abrvtn}\n`);
    lines.push("## Top Prescribed Drugs\n");

    // Aggregate by drug
    const drugMap = new Map<string, { claims: number; cost: number }>();
    for (const r of results) {
      const key = r.Brnd_Name;
      const existing = drugMap.get(key) || { claims: 0, cost: 0 };
      drugMap.set(key, {
        claims: existing.claims + parseInt(r.Tot_Clms || "0"),
        cost: existing.cost + parseFloat(r.Tot_Drug_Cst || "0"),
      });
    }

    const sorted = [...drugMap.entries()].sort((a, b) => b[1].cost - a[1].cost);
    for (const [drug, data] of sorted.slice(0, 10)) {
      lines.push(`- **${drug}**: ${data.claims} claims, ${formatCurrency(data.cost)}`);
    }

    return {
      content: [{ type: "text", text: lines.join("\n") }],
    };
  }

  // Search by drug
  const drugName = params.drug || params.query;
  if (!drugName) {
    return {
      content: [{ type: "text", text: "drug, query, or npi parameter required" }],
      isError: true,
    };
  }

  const maxResults = params.max_results || 10;
  const results = await client.getPrescribersForDrug(drugName, params.state, maxResults);

  if (results.length === 0) {
    return {
      content: [
        {
          type: "text",
          text: `No prescribers found for '${drugName}'${params.state ? ` in ${params.state}` : ""}`,
        },
      ],
    };
  }

  const lines = [
    `# Top Prescribers: ${drugName}${params.state ? ` (${params.state})` : ""}\n`,
  ];

  for (const p of results.slice(0, maxResults)) {
    lines.push(formatPrescriber(p));
    lines.push("");
  }

  return {
    content: [{ type: "text", text: lines.join("\n") }],
  };
}

async function handleTop(
  params: PartDParamsType,
  client: CMSClient
): Promise<ToolResult> {
  const maxResults = params.max_results || 20;
  const results = await client.getTopDrugsBySpending(maxResults);

  const lines = ["# Top Medicare Part D Drugs by Spending (2024)\n"];
  lines.push("| Rank | Drug | Generic | Spending | Beneficiaries |");
  lines.push("|------|------|---------|----------|---------------|");

  for (let i = 0; i < results.length; i++) {
    const d = results[i];
    lines.push(
      `| ${i + 1} | ${d.Brnd_Name} | ${d.Gnrc_Name} | ${formatCurrency(d.Tot_Spndng)} | ${parseInt(d.Tot_Benes).toLocaleString()} |`
    );
  }

  lines.push(`\n_Source: CMS Medicare Part D Spending Data (${results[0]?.Year || "2024"})_`);

  return {
    content: [{ type: "text", text: lines.join("\n") }],
  };
}

async function handleSearch(
  params: PartDParamsType,
  client: CMSClient
): Promise<ToolResult> {
  const query = params.query || params.drug;
  if (!query) {
    return {
      content: [{ type: "text", text: "query parameter required for search" }],
      isError: true,
    };
  }

  const maxResults = params.max_results || 15;
  const results = await client.searchDrug(query, maxResults);

  if (results.length === 0) {
    return {
      content: [{ type: "text", text: `No drugs found matching '${query}'` }],
    };
  }

  // Dedupe by brand name (keep Overall entries)
  const seen = new Set<string>();
  const unique = results.filter((d) => {
    if (seen.has(d.Brnd_Name)) return false;
    seen.add(d.Brnd_Name);
    return d.Mftr_Name === "Overall";
  });

  const lines = [`# Search Results: '${query}'\n`];

  for (const d of unique.slice(0, maxResults)) {
    lines.push(`- **${d.Brnd_Name}** (${d.Gnrc_Name}): ${formatCurrency(d.Tot_Spndng)} total, ${parseInt(d.Tot_Benes).toLocaleString()} beneficiaries`);
  }

  lines.push(`\nUse {"action": "drug", "drug": "..."} for full details.`);

  return {
    content: [{ type: "text", text: lines.join("\n") }],
  };
}

async function handleApi(
  params: PartDParamsType,
  client: CMSClient
): Promise<ToolResult> {
  const datasetMap: Record<string, string> = {
    quarterly: DATASETS.SPENDING_QUARTERLY,
    annual: DATASETS.SPENDING_ANNUAL,
    prescriber: DATASETS.PRESCRIBER_BY_DRUG,
    "prescriber-provider": DATASETS.PRESCRIBER_BY_PROVIDER,
    "prescriber-geo": DATASETS.PRESCRIBER_BY_GEO,
  };

  const datasetKey = params.dataset || "quarterly";
  const datasetId = datasetMap[datasetKey] || datasetKey;

  // Build params from query string or use defaults
  const apiParams: Record<string, string> = { size: "10" };

  if (params.query) {
    apiParams.keyword = params.query;
  }

  if (params.max_results) {
    apiParams.size = String(params.max_results);
  }

  const result = await client.apiRequest(datasetId, apiParams);
  return {
    content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
  };
}

function handleHelp(): ToolResult {
  return {
    content: [
      {
        type: "text",
        text: `# Medicare Part D MCP Server

Access CMS Medicare Part D drug spending and prescriber data.

## Actions

**drug** - Get drug spending details
  {"action": "drug", "drug": "Ozempic"}
  {"action": "drug", "drug": "Eliquis", "dataset": "annual"}

**spending** - Full spending analysis (quarterly + trends)
  {"action": "spending", "drug": "Humira"}

**prescribers** - Find prescribers for a drug or by NPI
  {"action": "prescribers", "drug": "Ozempic", "state": "CA"}
  {"action": "prescribers", "npi": "1234567890"}

**top** - Top drugs by total spending
  {"action": "top", "max_results": 20}

**search** - Search drugs by name
  {"action": "search", "query": "insulin"}

**api** - Raw CMS Data API access
  {"action": "api", "dataset": "quarterly", "query": "metformin"}

## Datasets

| Name | Description | Data |
|------|-------------|------|
| quarterly | Part D Spending by Drug | 2024 Q1-Q4 |
| annual | Part D Spending Trends | 2019-2023 |
| prescriber | Prescribers by Drug | 2022 |

## More Info
- CMS Data: https://data.cms.gov
- Part D Dashboard: https://data.cms.gov/tools/medicare-part-d-drug-spending-dashboard`,
      },
    ],
  };
}
