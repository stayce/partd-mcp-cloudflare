/**
 * Drug Reference MCP Server - Action Handlers
 */

import { DrugClient } from "./client";
import { ToolResult, DrugParamsType, RxDrugGroup, FDALabel } from "./types";

/**
 * Main action dispatcher
 */
export async function handleAction(
  params: DrugParamsType,
  client: DrugClient
): Promise<ToolResult> {
  try {
    switch (params.action) {
      case "search":
        return await handleSearch(params, client);
      case "ndc":
        return await handleNDC(params, client);
      case "adverse_events":
        return await handleAdverseEvents(params, client);
      case "label":
        return await handleLabel(params, client);
      case "recalls":
        return await handleRecalls(params, client);
      case "rxnorm":
        return await handleRxNorm(params, client);
      case "crossref":
        return await handleCrossref(params, client);
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

// ─── Helpers ─────────────────────────────────────────────

function truncate(text: string, maxLen: number = 500): string {
  if (!text || text.length <= maxLen) return text || "";
  return text.substring(0, maxLen) + "...";
}

function extractConcepts(drugGroup: RxDrugGroup): Array<{ rxcui: string; name: string; tty: string }> {
  const concepts: Array<{ rxcui: string; name: string; tty: string }> = [];
  for (const group of drugGroup.conceptGroup || []) {
    for (const prop of group.conceptProperties || []) {
      concepts.push({ rxcui: prop.rxcui, name: prop.name, tty: group.tty });
    }
  }
  return concepts;
}

// ─── Handlers ────────────────────────────────────────────

async function handleSearch(
  params: DrugParamsType,
  client: DrugClient
): Promise<ToolResult> {
  const drugName = params.drug || params.query;
  if (!drugName) {
    return { content: [{ type: "text", text: "drug or query parameter required" }], isError: true };
  }

  const drugGroup = await client.searchDrug(drugName);
  const concepts = extractConcepts(drugGroup);

  if (concepts.length === 0) {
    return { content: [{ type: "text", text: `No drugs found matching '${drugName}'` }] };
  }

  // Group by term type
  const ttyLabels: Record<string, string> = {
    SBD: "Branded Drug", SCD: "Clinical Drug", SBDG: "Branded Dose Group",
    SCDG: "Clinical Dose Group", SBDF: "Branded Dose Form", SCDF: "Clinical Dose Form",
    BN: "Brand Name", IN: "Ingredient", MIN: "Multiple Ingredients",
    PIN: "Precise Ingredient", BPCK: "Branded Pack", GPCK: "Generic Pack",
  };

  const lines = [`# Drug Search: '${drugName}'\n`];

  // Dedupe by rxcui
  const seen = new Set<string>();
  const unique = concepts.filter((c) => {
    if (seen.has(c.rxcui)) return false;
    seen.add(c.rxcui);
    return true;
  });

  const maxResults = params.max_results || 20;

  for (const c of unique.slice(0, maxResults)) {
    const label = ttyLabels[c.tty] || c.tty;
    lines.push(`- **${c.name}** (RxCUI: ${c.rxcui}, ${label})`);
  }

  lines.push(`\nUse {"action": "rxnorm", "rxcui": "..."} for full details or {"action": "crossref", "drug": "..."} for complete profile.`);

  return { content: [{ type: "text", text: lines.join("\n") }] };
}

async function handleNDC(
  params: DrugParamsType,
  client: DrugClient
): Promise<ToolResult> {
  const query = params.ndc || params.drug || params.query;
  if (!query) {
    return { content: [{ type: "text", text: "ndc, drug, or query parameter required" }], isError: true };
  }

  const products = await client.getNDCProduct(query, params.max_results || 10);

  if (products.length === 0) {
    return { content: [{ type: "text", text: `No NDC products found for '${query}'` }] };
  }

  const lines = [`# NDC Lookup: '${query}'\n`];

  for (const p of products) {
    lines.push(`## ${p.brand_name} (${p.generic_name})\n`);
    lines.push(`| Field | Value |`);
    lines.push(`|-------|-------|`);
    lines.push(`| NDC | ${p.product_ndc} |`);
    lines.push(`| Manufacturer | ${p.labeler_name} |`);
    lines.push(`| Dosage Form | ${p.dosage_form} |`);
    lines.push(`| Route | ${(p.route || []).join(", ")} |`);
    lines.push(`| Product Type | ${p.product_type} |`);
    lines.push(`| Marketing | ${p.marketing_category} |`);

    if (p.active_ingredients?.length) {
      lines.push(`\n**Active Ingredients:**`);
      for (const ing of p.active_ingredients) {
        lines.push(`- ${ing.name} (${ing.strength})`);
      }
    }

    if (p.openfda?.rxcui?.length) {
      lines.push(`\n**RxCUI:** ${p.openfda.rxcui.join(", ")}`);
    }

    lines.push("");
  }

  return { content: [{ type: "text", text: lines.join("\n") }] };
}

async function handleAdverseEvents(
  params: DrugParamsType,
  client: DrugClient
): Promise<ToolResult> {
  const drugName = params.drug || params.query;
  if (!drugName) {
    return { content: [{ type: "text", text: "drug or query parameter required" }], isError: true };
  }

  const maxResults = params.max_results || 20;

  // Fetch reactions and seriousness in parallel
  const [reactions, seriousness] = await Promise.all([
    client.getAdverseReactions(drugName, maxResults),
    client.getAdverseSeriousness(drugName),
  ]);

  if (reactions.length === 0 && seriousness.total === 0) {
    return { content: [{ type: "text", text: `No adverse event data found for '${drugName}'` }] };
  }

  const lines = [`# Adverse Events: ${drugName}\n`];

  // Seriousness overview
  if (seriousness.total > 0) {
    lines.push("## Report Summary\n");
    lines.push(`| Metric | Count |`);
    lines.push(`|--------|-------|`);
    lines.push(`| Total Reports | ${seriousness.total.toLocaleString()} |`);
    lines.push(`| Serious | ${seriousness.serious.toLocaleString()} |`);
    lines.push(`| Hospitalizations | ${seriousness.hospitalizations.toLocaleString()} |`);
    lines.push(`| Deaths | ${seriousness.deaths.toLocaleString()} |`);

    if (seriousness.total > 0) {
      const seriousPct = ((seriousness.serious / seriousness.total) * 100).toFixed(1);
      lines.push(`\n_${seriousPct}% of reports classified as serious_`);
    }
  }

  // Top reactions
  if (reactions.length > 0) {
    lines.push("\n## Top Reported Reactions\n");
    lines.push("| Rank | Reaction | Reports |");
    lines.push("|------|----------|---------|");

    for (let i = 0; i < reactions.length; i++) {
      lines.push(`| ${i + 1} | ${reactions[i].term} | ${reactions[i].count.toLocaleString()} |`);
    }
  }

  lines.push(`\n_Source: FDA Adverse Event Reporting System (FAERS). Reports do not establish causation._`);

  return { content: [{ type: "text", text: lines.join("\n") }] };
}

async function handleLabel(
  params: DrugParamsType,
  client: DrugClient
): Promise<ToolResult> {
  const drugName = params.drug || params.query;
  if (!drugName) {
    return { content: [{ type: "text", text: "drug or query parameter required" }], isError: true };
  }

  const label = await client.getDrugLabel(drugName);

  if (!label) {
    return { content: [{ type: "text", text: `No label data found for '${drugName}'` }] };
  }

  const brandName = label.openfda?.brand_name?.[0] || drugName;
  const genericName = label.openfda?.generic_name?.[0] || "";
  const manufacturer = label.openfda?.manufacturer_name?.[0] || "";

  const lines = [`# Drug Label: ${brandName}\n`];

  if (genericName) lines.push(`**Generic:** ${genericName}`);
  if (manufacturer) lines.push(`**Manufacturer:** ${manufacturer}`);
  lines.push("");

  if (label.boxed_warning?.length) {
    lines.push("## Boxed Warning\n");
    lines.push(truncate(label.boxed_warning[0], 800));
    lines.push("");
  }

  if (label.indications_and_usage?.length) {
    lines.push("## Indications and Usage\n");
    lines.push(truncate(label.indications_and_usage[0], 800));
    lines.push("");
  }

  if (label.dosage_and_administration?.length) {
    lines.push("## Dosage and Administration\n");
    lines.push(truncate(label.dosage_and_administration[0], 600));
    lines.push("");
  }

  if (label.contraindications?.length) {
    lines.push("## Contraindications\n");
    lines.push(truncate(label.contraindications[0], 600));
    lines.push("");
  }

  if (label.warnings?.length) {
    lines.push("## Warnings\n");
    lines.push(truncate(label.warnings[0], 600));
    lines.push("");
  }

  if (label.adverse_reactions?.length) {
    lines.push("## Adverse Reactions (from label)\n");
    lines.push(truncate(label.adverse_reactions[0], 600));
    lines.push("");
  }

  if (label.drug_interactions?.length) {
    lines.push("## Drug Interactions\n");
    lines.push(truncate(label.drug_interactions[0], 600));
    lines.push("");
  }

  lines.push("_Source: FDA Structured Product Labeling (SPL)_");

  return { content: [{ type: "text", text: lines.join("\n") }] };
}

async function handleRecalls(
  params: DrugParamsType,
  client: DrugClient
): Promise<ToolResult> {
  const drugName = params.drug || params.query;
  if (!drugName) {
    return { content: [{ type: "text", text: "drug or query parameter required" }], isError: true };
  }

  const recalls = await client.getDrugRecalls(drugName, params.max_results || 10);

  if (recalls.length === 0) {
    return { content: [{ type: "text", text: `No recalls found for '${drugName}'. This may mean no recalls exist or the drug name format differs.` }] };
  }

  const lines = [`# Recalls: ${drugName}\n`];
  lines.push(`**${recalls.length} recall(s) found**\n`);

  for (const r of recalls) {
    const classLabel = r.classification === "Class I" ? "Class I (most serious)" :
      r.classification === "Class II" ? "Class II (moderate)" :
      r.classification === "Class III" ? "Class III (least serious)" : r.classification;

    lines.push(`## ${r.recall_number} — ${classLabel}\n`);
    lines.push(`**Status:** ${r.status}`);
    lines.push(`**Date:** ${r.recall_initiation_date}`);
    lines.push(`**Firm:** ${r.recalling_firm} (${r.city}, ${r.state})`);
    lines.push(`**Type:** ${r.voluntary_mandated}`);
    lines.push(`**Reason:** ${truncate(r.reason_for_recall, 400)}`);
    lines.push(`**Product:** ${truncate(r.product_description, 300)}`);
    lines.push("");
  }

  return { content: [{ type: "text", text: lines.join("\n") }] };
}

async function handleRxNorm(
  params: DrugParamsType,
  client: DrugClient
): Promise<ToolResult> {
  const rxcui = params.rxcui;
  const drugName = params.drug || params.query;

  if (!rxcui && !drugName) {
    return { content: [{ type: "text", text: "rxcui, drug, or query parameter required" }], isError: true };
  }

  let targetRxcui = rxcui;

  // If no rxcui, search by name first
  if (!targetRxcui && drugName) {
    const drugGroup = await client.searchDrug(drugName);
    const concepts = extractConcepts(drugGroup);
    if (concepts.length === 0) {
      return { content: [{ type: "text", text: `No RxNorm concept found for '${drugName}'` }] };
    }
    targetRxcui = concepts[0].rxcui;
  }

  // Get related concepts and NDCs in parallel
  const [related, ndcs] = await Promise.all([
    client.getAllRelated(targetRxcui!),
    client.getNDCsForRxCUI(targetRxcui!),
  ]);

  const lines = [`# RxNorm: ${drugName || targetRxcui}\n`];
  lines.push(`**RxCUI:** ${targetRxcui}\n`);

  // Parse related concepts
  const relatedData = related as { allRelatedGroup?: { conceptGroup?: Array<{ tty: string; conceptProperties?: Array<{ rxcui: string; name: string }> }> } };

  const ttyLabels: Record<string, string> = {
    IN: "Ingredients", MIN: "Multiple Ingredients", PIN: "Precise Ingredients",
    BN: "Brand Names", SBD: "Branded Drugs", SCD: "Clinical Drugs",
    SBDG: "Branded Dose Groups", SCDG: "Clinical Dose Groups",
    SBDF: "Branded Dose Forms", SCDF: "Clinical Dose Forms", DF: "Dose Forms",
  };

  for (const group of relatedData.allRelatedGroup?.conceptGroup || []) {
    const props = group.conceptProperties || [];
    if (props.length === 0) continue;

    const label = ttyLabels[group.tty] || group.tty;
    lines.push(`## ${label}\n`);

    for (const p of props.slice(0, 10)) {
      lines.push(`- ${p.name} (RxCUI: ${p.rxcui})`);
    }
    if (props.length > 10) {
      lines.push(`- _...and ${props.length - 10} more_`);
    }
    lines.push("");
  }

  // NDC codes
  if (ndcs.length > 0) {
    lines.push(`## Associated NDC Codes (${ndcs.length})\n`);
    for (const ndc of ndcs.slice(0, 15)) {
      lines.push(`- ${ndc}`);
    }
    if (ndcs.length > 15) {
      lines.push(`- _...and ${ndcs.length - 15} more_`);
    }
  }

  return { content: [{ type: "text", text: lines.join("\n") }] };
}

async function handleCrossref(
  params: DrugParamsType,
  client: DrugClient
): Promise<ToolResult> {
  const drugName = params.drug || params.query;
  const ndc = params.ndc;

  if (!drugName && !ndc) {
    return { content: [{ type: "text", text: "drug, query, or ndc parameter required for crossref" }], isError: true };
  }

  let resolvedName = drugName || "";

  // If given NDC, resolve to drug name first
  if (ndc && !drugName) {
    const products = await client.getNDCProduct(ndc, 1);
    if (products.length > 0) {
      resolvedName = products[0].brand_name || products[0].generic_name;
    } else {
      return { content: [{ type: "text", text: `Could not resolve NDC '${ndc}' to a drug name` }] };
    }
  }

  const lines = [`# Drug Profile: ${resolvedName}\n`];

  // Fetch everything in parallel
  const [drugGroup, ndcProducts, reactions, seriousness, label, recalls] = await Promise.all([
    client.searchDrug(resolvedName).catch(() => null),
    client.getNDCProduct(resolvedName, 3).catch(() => []),
    client.getAdverseReactions(resolvedName, 10).catch(() => []),
    client.getAdverseSeriousness(resolvedName).catch(() => ({ total: 0, serious: 0, deaths: 0, hospitalizations: 0 })),
    client.getDrugLabel(resolvedName).catch(() => null),
    client.getDrugRecalls(resolvedName, 3).catch(() => []),
  ]);

  // ─── Identity (RxNorm) ───
  if (drugGroup) {
    const concepts = extractConcepts(drugGroup);
    if (concepts.length > 0) {
      lines.push("## Drug Identity (RxNorm)\n");
      for (const c of concepts.slice(0, 5)) {
        lines.push(`- **${c.name}** (RxCUI: ${c.rxcui}, ${c.tty})`);
      }
      lines.push("");
    }
  }

  // ─── Product Info (NDC) ───
  if (ndcProducts.length > 0) {
    const p = ndcProducts[0];
    lines.push("## Product Info (NDC Directory)\n");
    lines.push(`- **Brand:** ${p.brand_name}`);
    lines.push(`- **Generic:** ${p.generic_name}`);
    lines.push(`- **Manufacturer:** ${p.labeler_name}`);
    lines.push(`- **Form:** ${p.dosage_form}`);
    lines.push(`- **Route:** ${(p.route || []).join(", ")}`);
    lines.push(`- **NDC:** ${p.product_ndc}`);
    if (p.active_ingredients?.length) {
      lines.push(`- **Ingredients:** ${p.active_ingredients.map((i) => `${i.name} ${i.strength}`).join("; ")}`);
    }
    lines.push("");
  }

  // ─── Label Highlights ───
  if (label) {
    lines.push("## Prescribing Highlights\n");
    if (label.boxed_warning?.length) {
      lines.push(`**BOXED WARNING:** ${truncate(label.boxed_warning[0], 300)}\n`);
    }
    if (label.indications_and_usage?.length) {
      lines.push(`**Indications:** ${truncate(label.indications_and_usage[0], 300)}\n`);
    }
    if (label.contraindications?.length) {
      lines.push(`**Contraindications:** ${truncate(label.contraindications[0], 200)}\n`);
    }
  }

  // ─── Adverse Events (FAERS) ───
  if (seriousness.total > 0 || reactions.length > 0) {
    lines.push("## Adverse Events (FAERS)\n");

    if (seriousness.total > 0) {
      lines.push(`**${seriousness.total.toLocaleString()} total reports** | ${seriousness.serious.toLocaleString()} serious | ${seriousness.hospitalizations.toLocaleString()} hospitalizations | ${seriousness.deaths.toLocaleString()} deaths\n`);
    }

    if (reactions.length > 0) {
      lines.push("**Top Reactions:**");
      for (const r of reactions.slice(0, 8)) {
        lines.push(`- ${r.term} (${r.count.toLocaleString()})`);
      }
      lines.push("");
    }
  }

  // ─── Recalls ───
  if (recalls.length > 0) {
    lines.push("## Recalls\n");
    for (const r of recalls.slice(0, 3)) {
      lines.push(`- **${r.recall_number}** (${r.classification}, ${r.status}) — ${truncate(r.reason_for_recall, 150)}`);
    }
    lines.push("");
  } else {
    lines.push("## Recalls\n\nNo recalls found.\n");
  }

  lines.push("_Sources: NLM RxNorm, FDA NDC Directory, FDA FAERS, FDA SPL Labels, FDA Recall Enterprise System_");

  return { content: [{ type: "text", text: lines.join("\n") }] };
}

async function handleApi(
  params: DrugParamsType,
  client: DrugClient
): Promise<ToolResult> {
  const drugName = params.drug || params.query;
  const ndc = params.ndc;
  const rxcui = params.rxcui;

  if (rxcui) {
    const result = await client.getAllRelated(rxcui);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }

  if (ndc) {
    const products = await client.getNDCProduct(ndc);
    return { content: [{ type: "text", text: JSON.stringify(products, null, 2) }] };
  }

  if (drugName) {
    const result = await client.searchDrug(drugName);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }

  return { content: [{ type: "text", text: "Provide drug, ndc, or rxcui parameter" }], isError: true };
}

function handleHelp(): ToolResult {
  return {
    content: [
      {
        type: "text",
        text: `# Drug Reference MCP Server

Unified drug intelligence from RxNorm, openFDA FAERS, NDC Directory, Drug Labels, and Recall data.

## Actions

**search** - Find drugs by name (RxNorm)
  {"action": "search", "drug": "Ozempic"}
  {"action": "search", "query": "semaglutide"}

**ndc** - Look up NDC product info
  {"action": "ndc", "ndc": "0169-4130-12"}
  {"action": "ndc", "drug": "Ozempic"}

**adverse_events** - Top adverse reactions + seriousness breakdown (FAERS)
  {"action": "adverse_events", "drug": "Ozempic"}

**label** - Prescribing info: indications, warnings, interactions
  {"action": "label", "drug": "Ozempic"}

**recalls** - FDA recall/enforcement data
  {"action": "recalls", "drug": "metformin"}

**rxnorm** - Full RxNorm concept details + NDC codes
  {"action": "rxnorm", "rxcui": "2551560"}
  {"action": "rxnorm", "drug": "Ozempic"}

**crossref** - Complete drug profile from ALL sources in one call
  {"action": "crossref", "drug": "Ozempic"}
  {"action": "crossref", "ndc": "0169-4130-12"}

**api** - Raw API response (RxNorm or openFDA)
  {"action": "api", "drug": "Ozempic"}
  {"action": "api", "rxcui": "2551560"}

## Data Sources

| Source | API | Data |
|--------|-----|------|
| RxNorm | rxnav.nlm.nih.gov/REST | Drug identity, NDC mapping, ingredients |
| openFDA FAERS | api.fda.gov/drug/event.json | Adverse event reports |
| openFDA NDC | api.fda.gov/drug/ndc.json | Product info, manufacturers |
| openFDA Labels | api.fda.gov/drug/label.json | Prescribing information |
| openFDA Recalls | api.fda.gov/drug/enforcement.json | Recall/enforcement data |

All APIs are free and require no authentication.

## More Info
- RxNav: https://lhncbc.nlm.nih.gov/RxNav/
- openFDA: https://open.fda.gov/apis/drug/
- FAERS: https://open.fda.gov/apis/drug/event/`,
      },
    ],
  };
}
