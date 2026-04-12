/**
 * Drug Reference MCP Server - Type Definitions
 *
 * Unified drug intelligence from RxNorm, openFDA FAERS, NDC Directory,
 * Drug Labels, and Enforcement/Recall data.
 */

import { z } from "zod";

// Server metadata
export const SERVER_NAME = "drug-mcp-server";
export const SERVER_VERSION = "1.0.0";

export interface Env {}

export interface ToolResult {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}

// API base URLs
export const RXNORM_BASE = "https://rxnav.nlm.nih.gov/REST";
export const OPENFDA_BASE = "https://api.fda.gov/drug";

// --- RxNorm types ---

export interface RxDrugGroup {
  name: string;
  conceptGroup?: Array<{
    tty: string;
    conceptProperties?: Array<{
      rxcui: string;
      name: string;
      synonym: string;
      tty: string;
      language: string;
      suppress: string;
      umlscui: string;
    }>;
  }>;
}

export interface RxConceptProperties {
  rxcui: string;
  name: string;
  tty: string;
  language: string;
}

// --- openFDA types ---

export interface FDAAdverseEvent {
  safetyreportid: string;
  serious: string;
  seriousnessdeath: string;
  seriousnesshospitalization: string;
  receivedate: string;
  patient: {
    patientsex: string;
    patientonsetage?: string;
    reaction: Array<{ reactionmeddrapt: string; reactionoutcome: string }>;
    drug: Array<{
      medicinalproduct: string;
      drugindication: string;
      openfda?: {
        brand_name?: string[];
        generic_name?: string[];
        manufacturer_name?: string[];
        product_ndc?: string[];
        rxcui?: string[];
      };
    }>;
  };
}

export interface FDACountResult {
  term: string;
  count: number;
}

export interface FDANDCProduct {
  product_ndc: string;
  brand_name: string;
  brand_name_base: string;
  generic_name: string;
  labeler_name: string;
  dosage_form: string;
  route: string[];
  product_type: string;
  marketing_category: string;
  active_ingredients: Array<{ name: string; strength: string }>;
  packaging: Array<{ package_ndc: string; description: string }>;
  openfda?: {
    rxcui?: string[];
    manufacturer_name?: string[];
  };
}

export interface FDALabel {
  openfda?: {
    brand_name?: string[];
    generic_name?: string[];
    manufacturer_name?: string[];
    product_ndc?: string[];
    rxcui?: string[];
  };
  indications_and_usage?: string[];
  warnings?: string[];
  adverse_reactions?: string[];
  drug_interactions?: string[];
  dosage_and_administration?: string[];
  contraindications?: string[];
  boxed_warning?: string[];
}

export interface FDAEnforcement {
  recall_number: string;
  reason_for_recall: string;
  status: string;
  classification: string;
  product_description: string;
  recall_initiation_date: string;
  voluntary_mandated: string;
  recalling_firm: string;
  city: string;
  state: string;
  openfda?: {
    brand_name?: string[];
    product_ndc?: string[];
  };
}

// Action schema
export const DrugParams = z.object({
  action: z.enum([
    "search", "ndc", "adverse_events", "label",
    "recalls", "rxnorm", "crossref",
    "api", "help",
  ]),
  query: z.string().optional(),
  drug: z.string().optional(),
  ndc: z.string().optional(),
  rxcui: z.string().optional(),
  max_results: z.number().optional(),
});

export type DrugParamsType = z.infer<typeof DrugParams>;
