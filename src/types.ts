/**
 * Medicare Part D MCP Server - Type Definitions
 */

import { z } from "zod";

// Server metadata
export const SERVER_NAME = "partd-mcp-server";
export const SERVER_VERSION = "1.0.0";

// Environment interface for Cloudflare Workers
export interface Env {
  // No secrets needed - CMS data is public
}

// MCP Tool result type
export interface ToolResult {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}

// CMS Dataset UUIDs
export const DATASETS = {
  SPENDING_QUARTERLY: "4ff7c618-4e40-483a-b390-c8a58c94fa15",
  SPENDING_ANNUAL: "7e0b4365-fd63-4a29-8f5e-e0ac9f66a81b",
  PRESCRIBER_BY_DRUG: "9552739e-3d05-4c1b-8eff-ecabf391e2e5",
  PRESCRIBER_BY_PROVIDER: "14d8e8a9-7e9b-4370-a044-bf97c46b4b44",
  PRESCRIBER_BY_GEO: "c8ea3f8e-3a09-4fea-86f2-8902fb4b0920",
} as const;

// CMS API response types
export interface DrugSpendingQuarterly {
  Brnd_Name: string;
  Gnrc_Name: string;
  Mftr_Name: string;
  Year: string;
  Tot_Benes: string;
  Tot_Clms: string;
  Tot_Spndng: string;
  Avg_Spnd_Per_Bene: string;
  Avg_Spnd_Per_Clm: string;
  Drug_Uses: string;
}

export interface DrugSpendingAnnual {
  Brnd_Name: string;
  Gnrc_Name: string;
  Mftr_Name: string;
  Tot_Spndng_2023: string;
  Tot_Benes_2023: string;
  Tot_Clms_2023: string;
  Avg_Spnd_Per_Bene_2023: string;
  Chg_Avg_Spnd_Per_Dsg_Unt_22_23: string;
  CAGR_Avg_Spnd_Per_Dsg_Unt_19_23: string;
}

export interface PrescriberByDrug {
  Prscrbr_NPI: string;
  Prscrbr_Last_Org_Name: string;
  Prscrbr_First_Name: string;
  Prscrbr_City: string;
  Prscrbr_State_Abrvtn: string;
  Prscrbr_Type: string;
  Brnd_Name: string;
  Gnrc_Name: string;
  Tot_Clms: string;
  Tot_Drug_Cst: string;
  Tot_Day_Suply: string;
}

// Part D action schema - single tool with action dispatch
export const PartDParams = z.object({
  action: z.enum(["drug", "spending", "prescribers", "top", "search", "api", "help"]),
  query: z.string().optional(),
  drug: z.string().optional(),
  state: z.string().optional(),
  npi: z.string().optional(),
  dataset: z.enum(["quarterly", "annual", "prescriber"]).optional(),
  max_results: z.number().optional(),
  path: z.string().optional(),
});

export type PartDParamsType = z.infer<typeof PartDParams>;
