/**
 * Open Payments MCP Server - Action Handlers
 */

import { OpenPaymentsClient } from "./client";
import { ToolResult, OpenPaymentsParamsType, GeneralPayment } from "./types";

/**
 * Format currency
 */
function formatCurrency(value: string | number): string {
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "$0.00";
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
 * Get physician display name
 */
function physicianName(p: GeneralPayment): string {
  const first = p.covered_recipient_first_name || "";
  const last = p.covered_recipient_last_name || "";
  return first ? `${first} ${last}` : last;
}

/**
 * Get company short name
 */
function companyName(p: GeneralPayment): string {
  return p.applicable_manufacturer_or_applicable_gpo_making_payment_name || "Unknown";
}

/**
 * Main action dispatcher
 */
export async function handleAction(
  params: OpenPaymentsParamsType,
  client: OpenPaymentsClient
): Promise<ToolResult> {
  try {
    switch (params.action) {
      case "search":
        return await handleSearch(params, client);

      case "physician":
        return await handlePhysician(params, client);

      case "company":
        return await handleCompany(params, client);

      case "top_recipients":
        return await handleTopRecipients(params, client);

      case "top_payers":
        return await handleTopPayers(params, client);

      case "payment_types":
        return await handlePaymentTypes(params, client);

      case "specialty":
        return await handleSpecialty(params, client);

      case "state":
        return await handleState(params, client);

      case "summary":
        return await handleSummary(params, client);

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

async function handleSearch(
  params: OpenPaymentsParamsType,
  client: OpenPaymentsClient
): Promise<ToolResult> {
  const name = params.name || params.query;
  if (!name) {
    return {
      content: [{ type: "text", text: "name or query parameter required for search" }],
      isError: true,
    };
  }

  const maxResults = params.max_results || 25;
  const results = await client.searchPhysician(name, maxResults);

  if (results.length === 0) {
    return {
      content: [{ type: "text", text: `No physicians found matching '${name}'` }],
    };
  }

  // Dedupe by NPI, aggregate totals
  const npiMap = new Map<string, { name: string; specialty: string; city: string; state: string; total: number; count: number }>();

  for (const p of results) {
    const npi = p.covered_recipient_npi || p.covered_recipient_profile_id;
    const existing = npiMap.get(npi);
    const amount = parseFloat(p.total_amount_of_payment_usdollars || "0");

    if (existing) {
      existing.total += amount;
      existing.count += 1;
    } else {
      npiMap.set(npi, {
        name: physicianName(p),
        specialty: p.covered_recipient_specialty_1 || "N/A",
        city: p.recipient_city || "",
        state: p.recipient_state || "",
        total: amount,
        count: 1,
      });
    }
  }

  const sorted = [...npiMap.entries()].sort((a, b) => b[1].total - a[1].total);

  const lines = [`# Search Results: '${name}'\n`];

  for (const [npi, data] of sorted.slice(0, maxResults)) {
    lines.push(`- **${data.name}** (NPI: ${npi}) — ${data.specialty}`);
    lines.push(`  ${data.city}, ${data.state} | ${data.count} payments | ${formatCurrency(data.total)} total`);
  }

  lines.push(`\nUse {"action": "physician", "npi": "..."} for full payment details.`);

  return { content: [{ type: "text", text: lines.join("\n") }] };
}

async function handlePhysician(
  params: OpenPaymentsParamsType,
  client: OpenPaymentsClient
): Promise<ToolResult> {
  const npi = params.npi;
  if (!npi) {
    return {
      content: [{ type: "text", text: "npi parameter required for physician lookup" }],
      isError: true,
    };
  }

  const results = await client.getPhysicianPayments(npi, 200);

  if (results.length === 0) {
    return {
      content: [{ type: "text", text: `No payments found for NPI ${npi}` }],
    };
  }

  const p = results[0];
  const lines = [
    `# Physician: ${physicianName(p)}\n`,
    `**NPI:** ${npi}`,
    `**Specialty:** ${p.covered_recipient_specialty_1 || "N/A"}`,
    `**Location:** ${p.recipient_city}, ${p.recipient_state}`,
    "",
  ];

  // Aggregate by company
  const companyMap = new Map<string, { total: number; count: number }>();
  let grandTotal = 0;

  for (const r of results) {
    const company = companyName(r);
    const amount = parseFloat(r.total_amount_of_payment_usdollars || "0");
    grandTotal += amount;

    const existing = companyMap.get(company) || { total: 0, count: 0 };
    companyMap.set(company, {
      total: existing.total + amount,
      count: existing.count + 1,
    });
  }

  lines.push(`**Total Payments:** ${formatCurrency(grandTotal)} across ${results.length} records\n`);

  // Top payers
  lines.push("## Top Paying Companies\n");
  lines.push("| Company | Payments | Total |");
  lines.push("|---------|----------|-------|");

  const sortedCompanies = [...companyMap.entries()].sort((a, b) => b[1].total - a[1].total);
  for (const [company, data] of sortedCompanies.slice(0, 10)) {
    lines.push(`| ${company} | ${data.count} | ${formatCurrency(data.total)} |`);
  }

  // Aggregate by nature of payment
  const natureMap = new Map<string, { total: number; count: number }>();

  for (const r of results) {
    const nature = r.nature_of_payment_or_transfer_of_value || "Other";
    const amount = parseFloat(r.total_amount_of_payment_usdollars || "0");
    const existing = natureMap.get(nature) || { total: 0, count: 0 };
    natureMap.set(nature, {
      total: existing.total + amount,
      count: existing.count + 1,
    });
  }

  lines.push("\n## Payment Breakdown\n");
  lines.push("| Type | Count | Total |");
  lines.push("|------|-------|-------|");

  const sortedNatures = [...natureMap.entries()].sort((a, b) => b[1].total - a[1].total);
  for (const [nature, data] of sortedNatures) {
    lines.push(`| ${nature} | ${data.count} | ${formatCurrency(data.total)} |`);
  }

  return { content: [{ type: "text", text: lines.join("\n") }] };
}

async function handleCompany(
  params: OpenPaymentsParamsType,
  client: OpenPaymentsClient
): Promise<ToolResult> {
  const company = params.company || params.query;
  if (!company) {
    return {
      content: [{ type: "text", text: "company or query parameter required" }],
      isError: true,
    };
  }

  const maxResults = params.max_results || 100;
  const results = await client.getCompanyPayments(company, maxResults);

  if (results.length === 0) {
    return {
      content: [{ type: "text", text: `No payments found from company '${company}'` }],
    };
  }

  const actualCompany = companyName(results[0]);

  // Aggregate totals
  let totalAmount = 0;
  const recipientMap = new Map<string, { name: string; specialty: string; total: number; count: number }>();
  const natureMap = new Map<string, number>();

  for (const r of results) {
    const amount = parseFloat(r.total_amount_of_payment_usdollars || "0");
    totalAmount += amount;

    const npi = r.covered_recipient_npi || r.covered_recipient_profile_id;
    const existing = recipientMap.get(npi);
    if (existing) {
      existing.total += amount;
      existing.count += 1;
    } else {
      recipientMap.set(npi, {
        name: physicianName(r),
        specialty: r.covered_recipient_specialty_1 || "N/A",
        total: amount,
        count: 1,
      });
    }

    const nature = r.nature_of_payment_or_transfer_of_value || "Other";
    natureMap.set(nature, (natureMap.get(nature) || 0) + amount);
  }

  const lines = [
    `# Company: ${actualCompany}\n`,
    `**Total Payments:** ${formatCurrency(totalAmount)} across ${results.length} records`,
    `**Unique Recipients:** ${recipientMap.size}`,
    "",
  ];

  // Top recipients
  lines.push("## Top Recipients\n");
  lines.push("| Physician | Specialty | Payments | Total |");
  lines.push("|-----------|-----------|----------|-------|");

  const sortedRecipients = [...recipientMap.entries()].sort((a, b) => b[1].total - a[1].total);
  for (const [npi, data] of sortedRecipients.slice(0, 10)) {
    lines.push(`| ${data.name} (${npi}) | ${data.specialty} | ${data.count} | ${formatCurrency(data.total)} |`);
  }

  // Payment type breakdown
  lines.push("\n## Payment Types\n");
  lines.push("| Nature | Total |");
  lines.push("|--------|-------|");

  const sortedNatures = [...natureMap.entries()].sort((a, b) => b[1] - a[1]);
  for (const [nature, total] of sortedNatures) {
    lines.push(`| ${nature} | ${formatCurrency(total)} |`);
  }

  return { content: [{ type: "text", text: lines.join("\n") }] };
}

async function handleTopRecipients(
  params: OpenPaymentsParamsType,
  client: OpenPaymentsClient
): Promise<ToolResult> {
  const maxResults = params.max_results || 20;
  const results = await client.getTopPayments(500);

  // Aggregate by NPI
  const npiMap = new Map<string, { name: string; specialty: string; state: string; total: number; count: number }>();

  for (const p of results) {
    const npi = p.covered_recipient_npi || p.covered_recipient_profile_id;
    const amount = parseFloat(p.total_amount_of_payment_usdollars || "0");
    const existing = npiMap.get(npi);

    if (existing) {
      existing.total += amount;
      existing.count += 1;
    } else {
      npiMap.set(npi, {
        name: physicianName(p),
        specialty: p.covered_recipient_specialty_1 || "N/A",
        state: p.recipient_state || "",
        total: amount,
        count: 1,
      });
    }
  }

  const sorted = [...npiMap.entries()].sort((a, b) => b[1].total - a[1].total);

  const lines = ["# Top Payment Recipients\n"];
  lines.push("| Rank | Physician | Specialty | State | Payments | Total |");
  lines.push("|------|-----------|-----------|-------|----------|-------|");

  for (let i = 0; i < Math.min(sorted.length, maxResults); i++) {
    const [npi, data] = sorted[i];
    lines.push(
      `| ${i + 1} | ${data.name} (${npi}) | ${data.specialty} | ${data.state} | ${data.count} | ${formatCurrency(data.total)} |`
    );
  }

  lines.push(`\n_Based on top ${results.length} payment records by amount_`);

  return { content: [{ type: "text", text: lines.join("\n") }] };
}

async function handleTopPayers(
  params: OpenPaymentsParamsType,
  client: OpenPaymentsClient
): Promise<ToolResult> {
  const maxResults = params.max_results || 20;
  const results = await client.getTopPayments(500);

  // Aggregate by company
  const companyMap = new Map<string, { total: number; count: number; recipients: Set<string> }>();

  for (const p of results) {
    const company = companyName(p);
    const amount = parseFloat(p.total_amount_of_payment_usdollars || "0");
    const npi = p.covered_recipient_npi || p.covered_recipient_profile_id;
    const existing = companyMap.get(company);

    if (existing) {
      existing.total += amount;
      existing.count += 1;
      existing.recipients.add(npi);
    } else {
      companyMap.set(company, {
        total: amount,
        count: 1,
        recipients: new Set([npi]),
      });
    }
  }

  const sorted = [...companyMap.entries()].sort((a, b) => b[1].total - a[1].total);

  const lines = ["# Top Paying Companies\n"];
  lines.push("| Rank | Company | Recipients | Payments | Total |");
  lines.push("|------|---------|------------|----------|-------|");

  for (let i = 0; i < Math.min(sorted.length, maxResults); i++) {
    const [company, data] = sorted[i];
    lines.push(
      `| ${i + 1} | ${company} | ${data.recipients.size} | ${data.count} | ${formatCurrency(data.total)} |`
    );
  }

  lines.push(`\n_Based on top ${results.length} payment records by amount_`);

  return { content: [{ type: "text", text: lines.join("\n") }] };
}

async function handlePaymentTypes(
  params: OpenPaymentsParamsType,
  client: OpenPaymentsClient
): Promise<ToolResult> {
  const nature = params.nature || params.query;

  let results: GeneralPayment[];
  if (nature) {
    results = await client.getPaymentsByNature(nature, 200);
  } else {
    results = await client.getTopPayments(500);
  }

  if (results.length === 0) {
    return {
      content: [{ type: "text", text: nature ? `No payments found for type '${nature}'` : "No payment data available" }],
    };
  }

  // Aggregate by nature
  const natureMap = new Map<string, { total: number; count: number }>();

  for (const p of results) {
    const n = p.nature_of_payment_or_transfer_of_value || "Other";
    const amount = parseFloat(p.total_amount_of_payment_usdollars || "0");
    const existing = natureMap.get(n) || { total: 0, count: 0 };
    natureMap.set(n, {
      total: existing.total + amount,
      count: existing.count + 1,
    });
  }

  const sorted = [...natureMap.entries()].sort((a, b) => b[1].total - a[1].total);
  const grandTotal = sorted.reduce((sum, [, d]) => sum + d.total, 0);

  const lines = [`# Payment Types${nature ? `: '${nature}'` : ""}\n`];
  lines.push("| Nature of Payment | Records | Total | % of Total |");
  lines.push("|-------------------|---------|-------|------------|");

  for (const [n, data] of sorted) {
    const pct = grandTotal > 0 ? ((data.total / grandTotal) * 100).toFixed(1) : "0";
    lines.push(`| ${n} | ${data.count} | ${formatCurrency(data.total)} | ${pct}% |`);
  }

  lines.push(`\n**Grand Total:** ${formatCurrency(grandTotal)}`);

  return { content: [{ type: "text", text: lines.join("\n") }] };
}

async function handleSpecialty(
  params: OpenPaymentsParamsType,
  client: OpenPaymentsClient
): Promise<ToolResult> {
  const results = await client.getTopPayments(500);

  if (results.length === 0) {
    return {
      content: [{ type: "text", text: "No payment data available" }],
    };
  }

  // Aggregate by specialty
  const specMap = new Map<string, { total: number; count: number; providers: Set<string> }>();

  for (const p of results) {
    const spec = p.covered_recipient_specialty_1 || "Unknown";
    const amount = parseFloat(p.total_amount_of_payment_usdollars || "0");
    const npi = p.covered_recipient_npi || p.covered_recipient_profile_id;
    const existing = specMap.get(spec);

    if (existing) {
      existing.total += amount;
      existing.count += 1;
      existing.providers.add(npi);
    } else {
      specMap.set(spec, {
        total: amount,
        count: 1,
        providers: new Set([npi]),
      });
    }
  }

  const maxResults = params.max_results || 20;
  const sorted = [...specMap.entries()].sort((a, b) => b[1].total - a[1].total);

  const lines = ["# Payments by Physician Specialty\n"];
  lines.push("| Rank | Specialty | Physicians | Payments | Total |");
  lines.push("|------|-----------|------------|----------|-------|");

  for (let i = 0; i < Math.min(sorted.length, maxResults); i++) {
    const [spec, data] = sorted[i];
    lines.push(
      `| ${i + 1} | ${spec} | ${data.providers.size} | ${data.count} | ${formatCurrency(data.total)} |`
    );
  }

  return { content: [{ type: "text", text: lines.join("\n") }] };
}

async function handleState(
  params: OpenPaymentsParamsType,
  client: OpenPaymentsClient
): Promise<ToolResult> {
  const stateFilter = params.state;

  let results: GeneralPayment[];
  if (stateFilter) {
    results = await client.getPaymentsByState(stateFilter, 200);
  } else {
    results = await client.getTopPayments(500);
  }

  if (results.length === 0) {
    return {
      content: [{ type: "text", text: stateFilter ? `No payments found for state '${stateFilter}'` : "No payment data available" }],
    };
  }

  // Aggregate by state
  const stateMap = new Map<string, { total: number; count: number; providers: Set<string> }>();

  for (const p of results) {
    const st = p.recipient_state || "Unknown";
    const amount = parseFloat(p.total_amount_of_payment_usdollars || "0");
    const npi = p.covered_recipient_npi || p.covered_recipient_profile_id;
    const existing = stateMap.get(st);

    if (existing) {
      existing.total += amount;
      existing.count += 1;
      existing.providers.add(npi);
    } else {
      stateMap.set(st, {
        total: amount,
        count: 1,
        providers: new Set([npi]),
      });
    }
  }

  const sorted = [...stateMap.entries()].sort((a, b) => b[1].total - a[1].total);

  const lines = [
    stateFilter
      ? `# Payments in ${stateFilter}\n`
      : "# Payments by State\n",
  ];

  lines.push("| State | Physicians | Payments | Total |");
  lines.push("|-------|------------|----------|-------|");

  for (const [st, data] of sorted) {
    lines.push(`| ${st} | ${data.providers.size} | ${data.count} | ${formatCurrency(data.total)} |`);
  }

  return { content: [{ type: "text", text: lines.join("\n") }] };
}

async function handleSummary(
  params: OpenPaymentsParamsType,
  client: OpenPaymentsClient
): Promise<ToolResult> {
  const results = await client.getTopPayments(500);

  if (results.length === 0) {
    return {
      content: [{ type: "text", text: "No payment data available" }],
    };
  }

  let grandTotal = 0;
  const companyMap = new Map<string, number>();
  const physicianMap = new Map<string, { name: string; total: number }>();
  const natureMap = new Map<string, number>();

  for (const p of results) {
    const amount = parseFloat(p.total_amount_of_payment_usdollars || "0");
    grandTotal += amount;

    const company = companyName(p);
    companyMap.set(company, (companyMap.get(company) || 0) + amount);

    const npi = p.covered_recipient_npi || p.covered_recipient_profile_id;
    const existing = physicianMap.get(npi);
    if (existing) {
      existing.total += amount;
    } else {
      physicianMap.set(npi, { name: physicianName(p), total: amount });
    }

    const nature = p.nature_of_payment_or_transfer_of_value || "Other";
    natureMap.set(nature, (natureMap.get(nature) || 0) + amount);
  }

  const lines = ["# Open Payments Dashboard\n"];

  lines.push(`**Total:** ${formatCurrency(grandTotal)} across ${results.length} top payment records`);
  lines.push(`**Unique Physicians:** ${physicianMap.size}`);
  lines.push(`**Unique Companies:** ${companyMap.size}`);
  lines.push("");

  // Top 5 companies
  lines.push("## Top Companies\n");
  const topCompanies = [...companyMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  for (const [company, total] of topCompanies) {
    lines.push(`- **${company}**: ${formatCurrency(total)}`);
  }

  // Top 5 recipients
  lines.push("\n## Top Recipients\n");
  const topPhysicians = [...physicianMap.entries()].sort((a, b) => b[1].total - a[1].total).slice(0, 5);
  for (const [npi, data] of topPhysicians) {
    lines.push(`- **${data.name}** (NPI: ${npi}): ${formatCurrency(data.total)}`);
  }

  // Payment type breakdown
  lines.push("\n## Payment Types\n");
  const topNatures = [...natureMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  for (const [nature, total] of topNatures) {
    lines.push(`- ${nature}: ${formatCurrency(total)}`);
  }

  lines.push(`\n_Use other actions for deeper analysis: physician, company, top_recipients, top_payers, specialty_`);

  return { content: [{ type: "text", text: lines.join("\n") }] };
}

async function handleApi(
  params: OpenPaymentsParamsType,
  client: OpenPaymentsClient
): Promise<ToolResult> {
  const conditions = [];

  if (params.npi) {
    conditions.push({
      resource: "t",
      property: "covered_recipient_npi",
      value: params.npi,
      operator: "=",
    });
  }

  if (params.company) {
    conditions.push({
      resource: "t",
      property: "applicable_manufacturer_or_applicable_gpo_making_payment_name",
      value: `%${params.company}%`,
      operator: "LIKE",
    });
  }

  if (params.state) {
    conditions.push({
      resource: "t",
      property: "recipient_state",
      value: params.state.toUpperCase(),
      operator: "=",
    });
  }

  if (params.nature) {
    conditions.push({
      resource: "t",
      property: "nature_of_payment_or_transfer_of_value",
      value: `%${params.nature}%`,
      operator: "LIKE",
    });
  }

  const limit = params.max_results || 10;
  const result = await client.rawQuery(conditions, [], limit);

  return {
    content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
  };
}

function handleHelp(): ToolResult {
  return {
    content: [
      {
        type: "text",
        text: `# Open Payments MCP Server

Access CMS Open Payments data — pharmaceutical and medical device company payments to physicians.

## Actions

**search** - Search for a physician by name
  {"action": "search", "name": "John Smith"}
  {"action": "search", "query": "Smith"}

**physician** - Full payment profile by NPI
  {"action": "physician", "npi": "1234567890"}

**company** - Payments from a specific company
  {"action": "company", "company": "Pfizer"}
  {"action": "company", "company": "Novo Nordisk"}

**top_recipients** - Physicians receiving the most payments
  {"action": "top_recipients", "max_results": 20}

**top_payers** - Companies making the most payments
  {"action": "top_payers", "max_results": 20}

**payment_types** - Breakdown by payment nature
  {"action": "payment_types"}
  {"action": "payment_types", "nature": "Food and Beverage"}

**specialty** - Payments by physician specialty
  {"action": "specialty"}

**state** - Geographic breakdown of payments
  {"action": "state"}
  {"action": "state", "state": "CA"}

**summary** - Dashboard overview
  {"action": "summary"}

**api** - Raw DKAN API query
  {"action": "api", "npi": "1234567890", "max_results": 5}

## Payment Categories
Food and Beverage, Travel and Lodging, Consulting Fee, Compensation for Services, Honoraria, Gift, Entertainment, Education, Research, Charitable Contribution, Royalty or License, Grant, Space Rental

## Data Source
CMS Open Payments (Sunshine Act): https://openpaymentsdata.cms.gov
Program Year 2023 General Payment Data

## More Info
- Open Payments: https://www.cms.gov/priorities/key-initiatives/open-payments
- Data Overview: https://www.cms.gov/priorities/key-initiatives/open-payments/data`,
      },
    ],
  };
}
