/**
 * Open Payments MCP Server - CMS DKAN API Client
 *
 * Uses the DKAN API at openpaymentsdata.cms.gov
 * Endpoint: /api/1/datastore/query/{datasetId}/0
 * Max 500 records per request, pagination via offset
 */

import { DEFAULT_DATASET, GeneralPayment } from "./types";

const API_BASE = "https://openpaymentsdata.cms.gov/api/1/datastore/query";

interface DKANCondition {
  resource: string;
  property: string;
  value: string;
  operator: string;
}

interface DKANSort {
  property: string;
  order: "asc" | "desc";
}

interface DKANQuery {
  conditions?: DKANCondition[];
  sorts?: DKANSort[];
  limit?: number;
  offset?: number;
  keys?: boolean;
}

interface DKANResponse {
  results: Record<string, string>[];
  count: number;
  schema: Record<string, unknown>;
  query: Record<string, unknown>;
}

export class OpenPaymentsClient {
  private datasetId: string;

  constructor(datasetId: string = DEFAULT_DATASET) {
    this.datasetId = datasetId;
  }

  /**
   * Query the DKAN datastore API
   */
  private async query(
    conditions: DKANCondition[] = [],
    sorts: DKANSort[] = [],
    limit: number = 25,
    offset: number = 0
  ): Promise<GeneralPayment[]> {
    const url = `${API_BASE}/${this.datasetId}/0`;

    const body: DKANQuery = {
      conditions,
      sorts,
      limit: Math.min(limit, 500),
      offset,
      keys: true,
    };

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`Open Payments API error: ${response.status} ${response.statusText}`);
    }

    const data: DKANResponse = await response.json();
    return data.results as unknown as GeneralPayment[];
  }

  /**
   * Search for a physician by name
   */
  async searchPhysician(name: string, limit: number = 25): Promise<GeneralPayment[]> {
    // Split name into parts for first/last name matching
    const parts = name.trim().split(/\s+/);
    const conditions: DKANCondition[] = [];

    if (parts.length >= 2) {
      conditions.push({
        resource: "t",
        property: "covered_recipient_first_name",
        value: `%${parts[0]}%`,
        operator: "LIKE",
      });
      conditions.push({
        resource: "t",
        property: "covered_recipient_last_name",
        value: `%${parts[parts.length - 1]}%`,
        operator: "LIKE",
      });
    } else {
      conditions.push({
        resource: "t",
        property: "covered_recipient_last_name",
        value: `%${parts[0]}%`,
        operator: "LIKE",
      });
    }

    return this.query(
      conditions,
      [{ property: "total_amount_of_payment_usdollars", order: "desc" }],
      limit
    );
  }

  /**
   * Get all payments to a physician by NPI
   */
  async getPhysicianPayments(npi: string, limit: number = 100): Promise<GeneralPayment[]> {
    return this.query(
      [{
        resource: "t",
        property: "covered_recipient_npi",
        value: npi,
        operator: "=",
      }],
      [{ property: "total_amount_of_payment_usdollars", order: "desc" }],
      limit
    );
  }

  /**
   * Get payments from a specific company/manufacturer
   */
  async getCompanyPayments(company: string, limit: number = 100): Promise<GeneralPayment[]> {
    return this.query(
      [{
        resource: "t",
        property: "applicable_manufacturer_or_applicable_gpo_making_payment_name",
        value: `%${company}%`,
        operator: "LIKE",
      }],
      [{ property: "total_amount_of_payment_usdollars", order: "desc" }],
      limit
    );
  }

  /**
   * Get top payments (for top recipients/payers analysis)
   */
  async getTopPayments(limit: number = 500): Promise<GeneralPayment[]> {
    return this.query(
      [],
      [{ property: "total_amount_of_payment_usdollars", order: "desc" }],
      limit
    );
  }

  /**
   * Get payments filtered by state
   */
  async getPaymentsByState(state: string, limit: number = 100): Promise<GeneralPayment[]> {
    return this.query(
      [{
        resource: "t",
        property: "recipient_state",
        value: state.toUpperCase(),
        operator: "=",
      }],
      [{ property: "total_amount_of_payment_usdollars", order: "desc" }],
      limit
    );
  }

  /**
   * Get payments by nature of payment
   */
  async getPaymentsByNature(nature: string, limit: number = 100): Promise<GeneralPayment[]> {
    return this.query(
      [{
        resource: "t",
        property: "nature_of_payment_or_transfer_of_value",
        value: `%${nature}%`,
        operator: "LIKE",
      }],
      [{ property: "total_amount_of_payment_usdollars", order: "desc" }],
      limit
    );
  }

  /**
   * Raw API query for escape valve
   */
  async rawQuery(
    conditions: DKANCondition[] = [],
    sorts: DKANSort[] = [],
    limit: number = 25
  ): Promise<unknown> {
    const url = `${API_BASE}/${this.datasetId}/0`;

    const body: DKANQuery = {
      conditions,
      sorts,
      limit: Math.min(limit, 500),
      offset: 0,
      keys: true,
    };

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`Open Payments API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }
}
