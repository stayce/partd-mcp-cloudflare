/**
 * Open Payments MCP Server - Type Definitions
 */

import { z } from "zod";

// Server metadata
export const SERVER_NAME = "open-payments-mcp-server";
export const SERVER_VERSION = "1.0.0";

// Environment interface for Cloudflare Workers
export interface Env {
  // No secrets needed - Open Payments data is public
}

// MCP Tool result type
export interface ToolResult {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}

// Dataset identifiers for OpenPaymentsData.cms.gov DKAN API
// These are dataset UUIDs — update when new program years are published
export const DATASETS = {
  GENERAL_2024: "fb3a65aa-c901-4a38-a813-b04b00dfa2a9", // Update when 2024 dataset ID is available
  GENERAL_2023: "fb3a65aa-c901-4a38-a813-b04b00dfa2a9",
  GENERAL_2021: "0380bbeb-aea1-58b6-b708-829f92a48202",
  GENERAL_2020: "a08c4b30-5cf3-4948-ad40-36f404619019",
} as const;

// Default dataset to query
export const DEFAULT_DATASET = DATASETS.GENERAL_2023;

// CMS Open Payments General Payment record
export interface GeneralPayment {
  record_id: string;
  change_type: string;
  covered_recipient_type: string;
  covered_recipient_profile_id: string;
  covered_recipient_npi: string;
  covered_recipient_first_name: string;
  covered_recipient_middle_name: string;
  covered_recipient_last_name: string;
  covered_recipient_name_suffix: string;
  recipient_primary_business_street_address_line1: string;
  recipient_city: string;
  recipient_state: string;
  recipient_zip_code: string;
  recipient_country: string;
  covered_recipient_specialty_1: string;
  covered_recipient_specialty_2: string;
  covered_recipient_specialty_3: string;
  applicable_manufacturer_or_applicable_gpo_making_payment_name: string;
  applicable_manufacturer_or_applicable_gpo_making_payment_id: string;
  applicable_manufacturer_or_applicable_gpo_making_payment_state: string;
  applicable_manufacturer_or_applicable_gpo_making_payment_country: string;
  total_amount_of_payment_usdollars: string;
  number_of_payments_included_in_total_amount: string;
  form_of_payment_or_transfer_of_value: string;
  nature_of_payment_or_transfer_of_value: string;
  date_of_payment: string;
  physician_ownership_indicator: string;
  third_party_payment_recipient_indicator: string;
  name_of_drug_or_biological_or_device_or_medical_supply_1: string;
  product_category_or_therapeutic_area_1: string;
  name_of_drug_or_biological_or_device_or_medical_supply_2: string;
  product_category_or_therapeutic_area_2: string;
  contextual_information: string;
  program_year: string;
  payment_publication_date: string;
}

// Action schema - single tool with action dispatch
export const OpenPaymentsParams = z.object({
  action: z.enum([
    "search", "physician", "company",
    "top_recipients", "top_payers", "payment_types",
    "specialty", "state", "summary",
    "api", "help",
  ]),
  query: z.string().optional(),
  npi: z.string().optional(),
  name: z.string().optional(),
  company: z.string().optional(),
  specialty: z.string().optional(),
  state: z.string().optional(),
  nature: z.string().optional(),
  max_results: z.number().optional(),
  year: z.string().optional(),
});

export type OpenPaymentsParamsType = z.infer<typeof OpenPaymentsParams>;
