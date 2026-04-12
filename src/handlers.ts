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
  PrescriberByGeo,
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

      case "compare":
        return await handleCompare(params, client);

      case "geography":
        return await handleGeography(params, client);

      case "manufacturer":
        return await handleManufacturer(params, client);

      case "stats":
        return await handleStats(params, client);

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
  const sortBy = params.sort || "spending";
  const results = await client.getTopDrugs(sortBy, maxResults);

  const sortLabel: Record<string, string> = {
    spending: "Spending",
    beneficiaries: "Beneficiaries",
    claims: "Claims",
  };

  const lines = [`# Top Medicare Part D Drugs by ${sortLabel[sortBy]} (2024)\n`];
  lines.push("| Rank | Drug | Generic | Spending | Beneficiaries | Claims |");
  lines.push("|------|------|---------|----------|---------------|--------|");

  for (let i = 0; i < results.length; i++) {
    const d = results[i];
    lines.push(
      `| ${i + 1} | ${d.Brnd_Name} | ${d.Gnrc_Name} | ${formatCurrency(d.Tot_Spndng)} | ${parseInt(d.Tot_Benes).toLocaleString()} | ${parseInt(d.Tot_Clms).toLocaleString()} |`
    );
  }

  lines.push(`\n_Sorted by: ${sortLabel[sortBy]} | Source: CMS Medicare Part D Spending Data (${results[0]?.Year || "2024"})_`);

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

async function handleCompare(
  params: PartDParamsType,
  client: CMSClient
): Promise<ToolResult> {
  const drug1 = params.drug || params.query;
  const drug2 = params.drug2;

  if (!drug1 || !drug2) {
    return {
      content: [{ type: "text", text: "Both 'drug' and 'drug2' parameters required for compare" }],
      isError: true,
    };
  }

  const [q1, q2, a1, a2] = await Promise.all([
    client.getDrugSpendingQuarterly(drug1),
    client.getDrugSpendingQuarterly(drug2),
    client.getDrugSpendingAnnual(drug1),
    client.getDrugSpendingAnnual(drug2),
  ]);

  const qd1 = q1.find((d) => d.Mftr_Name === "Overall") || q1[0];
  const qd2 = q2.find((d) => d.Mftr_Name === "Overall") || q2[0];
  const ad1 = a1.find((d) => d.Mftr_Name === "Overall") || a1[0];
  const ad2 = a2.find((d) => d.Mftr_Name === "Overall") || a2[0];

  if (!qd1 && !ad1) {
    return { content: [{ type: "text", text: `No data found for '${drug1}'` }] };
  }
  if (!qd2 && !ad2) {
    return { content: [{ type: "text", text: `No data found for '${drug2}'` }] };
  }

  const lines = [`# Drug Comparison: ${drug1} vs ${drug2}\n`];

  if (qd1 && qd2) {
    lines.push("## Current Spending (2024)\n");
    lines.push(`| Metric | ${qd1.Brnd_Name} | ${qd2.Brnd_Name} |`);
    lines.push("|--------|--------|--------|");
    lines.push(`| Generic | ${qd1.Gnrc_Name} | ${qd2.Gnrc_Name} |`);
    lines.push(`| Total Spending | ${formatCurrency(qd1.Tot_Spndng)} | ${formatCurrency(qd2.Tot_Spndng)} |`);
    lines.push(`| Beneficiaries | ${parseInt(qd1.Tot_Benes).toLocaleString()} | ${parseInt(qd2.Tot_Benes).toLocaleString()} |`);
    lines.push(`| Claims | ${parseInt(qd1.Tot_Clms).toLocaleString()} | ${parseInt(qd2.Tot_Clms).toLocaleString()} |`);
    lines.push(`| Avg/Beneficiary | ${formatCurrency(qd1.Avg_Spnd_Per_Bene)} | ${formatCurrency(qd2.Avg_Spnd_Per_Bene)} |`);
    lines.push(`| Avg/Claim | ${formatCurrency(qd1.Avg_Spnd_Per_Clm)} | ${formatCurrency(qd2.Avg_Spnd_Per_Clm)} |`);
  }

  if (ad1 && ad2) {
    lines.push("\n## Trends\n");
    lines.push(`| Metric | ${ad1.Brnd_Name} | ${ad2.Brnd_Name} |`);
    lines.push("|--------|--------|--------|");
    lines.push(`| 2023 Spending | ${formatCurrency(ad1.Tot_Spndng_2023)} | ${formatCurrency(ad2.Tot_Spndng_2023)} |`);
    lines.push(`| 2023 Beneficiaries | ${parseInt(ad1.Tot_Benes_2023).toLocaleString()} | ${parseInt(ad2.Tot_Benes_2023).toLocaleString()} |`);

    if (ad1.Chg_Avg_Spnd_Per_Dsg_Unt_22_23 && ad2.Chg_Avg_Spnd_Per_Dsg_Unt_22_23) {
      const c1 = parseFloat(ad1.Chg_Avg_Spnd_Per_Dsg_Unt_22_23) * 100;
      const c2 = parseFloat(ad2.Chg_Avg_Spnd_Per_Dsg_Unt_22_23) * 100;
      lines.push(`| YoY Change (2022-2023) | ${c1 >= 0 ? "+" : ""}${c1.toFixed(1)}% | ${c2 >= 0 ? "+" : ""}${c2.toFixed(1)}% |`);
    }

    if (ad1.CAGR_Avg_Spnd_Per_Dsg_Unt_19_23 && ad2.CAGR_Avg_Spnd_Per_Dsg_Unt_19_23) {
      const g1 = parseFloat(ad1.CAGR_Avg_Spnd_Per_Dsg_Unt_19_23) * 100;
      const g2 = parseFloat(ad2.CAGR_Avg_Spnd_Per_Dsg_Unt_19_23) * 100;
      lines.push(`| 4-Year CAGR (2019-2023) | ${g1 >= 0 ? "+" : ""}${g1.toFixed(1)}% | ${g2 >= 0 ? "+" : ""}${g2.toFixed(1)}% |`);
    }
  }

  return { content: [{ type: "text", text: lines.join("\n") }] };
}

async function handleGeography(
  params: PartDParamsType,
  client: CMSClient
): Promise<ToolResult> {
  const drugName = params.drug || params.query;
  if (!drugName) {
    return {
      content: [{ type: "text", text: "drug or query parameter required for geography" }],
      isError: true,
    };
  }

  const maxResults = params.max_results || 25;
  const results = await client.getPrescribersByGeo(drugName, params.state, maxResults);

  if (results.length === 0) {
    return {
      content: [{
        type: "text",
        text: `No geographic data found for '${drugName}'${params.state ? ` in ${params.state}` : ""}`,
      }],
    };
  }

  const lines = [
    `# Geographic Prescribing: ${drugName}${params.state ? ` (${params.state})` : ""}\n`,
  ];

  const sorted = [...results].sort(
    (a, b) => parseFloat(b.Tot_Drug_Cst || "0") - parseFloat(a.Tot_Drug_Cst || "0")
  );

  lines.push("| State | Claims | Cost | Beneficiaries |");
  lines.push("|-------|--------|------|---------------|");

  for (const g of sorted.slice(0, maxResults)) {
    const desc = g.Prscrbr_Geo_Desc || "Unknown";
    const code = g.Prscrbr_Geo_Cd || "";
    const label = code ? `${desc} (${code})` : desc;
    lines.push(
      `| ${label} | ${parseInt(g.Tot_Clms || "0").toLocaleString()} | ${formatCurrency(g.Tot_Drug_Cst || "0")} | ${parseInt(g.Tot_Benes || "0").toLocaleString()} |`
    );
  }

  return { content: [{ type: "text", text: lines.join("\n") }] };
}

async function handleManufacturer(
  params: PartDParamsType,
  client: CMSClient
): Promise<ToolResult> {
  const mfr = params.manufacturer || params.query;
  if (!mfr) {
    return {
      content: [{ type: "text", text: "manufacturer or query parameter required" }],
      isError: true,
    };
  }

  const maxResults = params.max_results || 25;
  const results = await client.getDrugsByManufacturer(mfr, maxResults);

  if (results.length === 0) {
    return {
      content: [{ type: "text", text: `No drugs found for manufacturer '${mfr}'` }],
    };
  }

  let totalSpending = 0;
  let totalBenes = 0;
  let totalClaims = 0;
  for (const d of results) {
    totalSpending += parseFloat(d.Tot_Spndng || "0");
    totalBenes += parseInt(d.Tot_Benes || "0");
    totalClaims += parseInt(d.Tot_Clms || "0");
  }

  const lines = [
    `# Manufacturer: ${results[0].Mftr_Name}\n`,
    `**Portfolio Summary:** ${results.length} drug(s) found`,
    `- Total Spending: ${formatCurrency(totalSpending)}`,
    `- Total Beneficiaries: ${totalBenes.toLocaleString()}`,
    `- Total Claims: ${totalClaims.toLocaleString()}`,
    "",
    "## Drugs\n",
    "| Drug | Generic | Spending | Beneficiaries |",
    "|------|---------|----------|---------------|",
  ];

  const sorted = [...results].sort(
    (a, b) => parseFloat(b.Tot_Spndng) - parseFloat(a.Tot_Spndng)
  );

  for (const d of sorted) {
    lines.push(
      `| ${d.Brnd_Name} | ${d.Gnrc_Name} | ${formatCurrency(d.Tot_Spndng)} | ${parseInt(d.Tot_Benes).toLocaleString()} |`
    );
  }

  return { content: [{ type: "text", text: lines.join("\n") }] };
}

async function handleStats(
  params: PartDParamsType,
  client: CMSClient
): Promise<ToolResult> {
  const datasetMap: Record<string, { id: string; name: string }> = {
    quarterly: { id: DATASETS.SPENDING_QUARTERLY, name: "Spending (Quarterly)" },
    annual: { id: DATASETS.SPENDING_ANNUAL, name: "Spending (Annual)" },
    prescriber: { id: DATASETS.PRESCRIBER_BY_DRUG, name: "Prescriber by Drug" },
    "prescriber-provider": { id: DATASETS.PRESCRIBER_BY_PROVIDER, name: "Prescriber by Provider" },
    "prescriber-geo": { id: DATASETS.PRESCRIBER_BY_GEO, name: "Prescriber by Geography" },
  };

  if (params.dataset) {
    const entry = datasetMap[params.dataset];
    if (!entry) {
      return {
        content: [{ type: "text", text: `Unknown dataset: ${params.dataset}` }],
        isError: true,
      };
    }
    const stats = await client.getDatasetStats(entry.id);
    return {
      content: [{
        type: "text",
        text: `# Dataset: ${entry.name}\n\n\`\`\`json\n${JSON.stringify(stats, null, 2)}\n\`\`\``,
      }],
    };
  }

  const entries = Object.entries(datasetMap);
  const allStats = await Promise.all(
    entries.map(([, v]) => client.getDatasetStats(v.id))
  );

  const lines = ["# CMS Medicare Part D Dataset Statistics\n"];

  for (let i = 0; i < entries.length; i++) {
    const [, { name }] = entries[i];
    lines.push(`## ${name}\n`);
    lines.push(`\`\`\`json\n${JSON.stringify(allStats[i], null, 2)}\n\`\`\``);
    lines.push("");
  }

  return { content: [{ type: "text", text: lines.join("\n") }] };
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

**top** - Top drugs by spending, beneficiaries, or claims
  {"action": "top", "max_results": 20}
  {"action": "top", "sort": "beneficiaries", "max_results": 10}

**search** - Search drugs by name
  {"action": "search", "query": "insulin"}

**compare** - Compare two drugs side by side
  {"action": "compare", "drug": "Ozempic", "drug2": "Mounjaro"}

**geography** - Prescribing patterns by state/region
  {"action": "geography", "drug": "Ozempic"}
  {"action": "geography", "drug": "Eliquis", "state": "TX"}

**manufacturer** - All drugs by a manufacturer
  {"action": "manufacturer", "manufacturer": "Eli Lilly and Company"}

**stats** - Dataset metadata and statistics
  {"action": "stats"}
  {"action": "stats", "dataset": "quarterly"}

**api** - Raw CMS Data API access
  {"action": "api", "dataset": "quarterly", "query": "metformin"}

## Datasets

| Name | Description | Data |
|------|-------------|------|
| quarterly | Part D Spending by Drug | 2024 Q1-Q4 |
| annual | Part D Spending Trends | 2019-2023 |
| prescriber | Prescribers by Drug | 2022 |
| prescriber-provider | Prescribers by Provider | 2022 |
| prescriber-geo | Prescribers by Geography | 2022 |

## More Info
- CMS Data: https://data.cms.gov
- Part D Dashboard: https://data.cms.gov/tools/medicare-part-d-drug-spending-dashboard`,
      },
    ],
  };
}
