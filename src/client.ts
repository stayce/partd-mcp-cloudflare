/**
 * Medicare Part D MCP Server - CMS Data API Client
 */

import {
  DATASETS,
  DrugSpendingQuarterly,
  DrugSpendingAnnual,
  PrescriberByDrug,
} from "./types";

const CMS_BASE_URL = "https://data.cms.gov/data-api/v1/dataset";

export class CMSClient {
  /**
   * Make a request to the CMS Data API
   */
  private async request<T>(
    datasetId: string,
    params: Record<string, string> = {}
  ): Promise<T[]> {
    const url = new URL(`${CMS_BASE_URL}/${datasetId}/data`);

    // Add default size if not specified
    if (!params.size) {
      params.size = "25";
    }

    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }

    const response = await fetch(url.toString(), {
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`CMS API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Search for drugs by name (brand or generic)
   */
  async searchDrug(query: string, maxResults: number = 25): Promise<DrugSpendingQuarterly[]> {
    return this.request<DrugSpendingQuarterly>(DATASETS.SPENDING_QUARTERLY, {
      keyword: query,
      size: String(maxResults),
    });
  }

  /**
   * Get drug spending details (quarterly)
   */
  async getDrugSpendingQuarterly(drugName: string): Promise<DrugSpendingQuarterly[]> {
    return this.request<DrugSpendingQuarterly>(DATASETS.SPENDING_QUARTERLY, {
      keyword: drugName,
      size: "10",
    });
  }

  /**
   * Get drug spending trends (annual, multi-year)
   */
  async getDrugSpendingAnnual(drugName: string): Promise<DrugSpendingAnnual[]> {
    return this.request<DrugSpendingAnnual>(DATASETS.SPENDING_ANNUAL, {
      keyword: drugName,
      size: "10",
    });
  }

  /**
   * Get top drugs by spending
   */
  async getTopDrugsBySpending(maxResults: number = 25): Promise<DrugSpendingQuarterly[]> {
    // The API returns data sorted, we filter to "Overall" manufacturer
    const results = await this.request<DrugSpendingQuarterly>(
      DATASETS.SPENDING_QUARTERLY,
      { size: String(maxResults * 2) }
    );

    // Filter to Overall (aggregate) and sort by spending
    return results
      .filter((d) => d.Mftr_Name === "Overall")
      .sort((a, b) => parseFloat(b.Tot_Spndng) - parseFloat(a.Tot_Spndng))
      .slice(0, maxResults);
  }

  /**
   * Get prescribers for a specific drug
   */
  async getPrescribersForDrug(
    drugName: string,
    state?: string,
    maxResults: number = 25
  ): Promise<PrescriberByDrug[]> {
    const params: Record<string, string> = {
      keyword: drugName,
      size: String(maxResults),
    };

    const results = await this.request<PrescriberByDrug>(
      DATASETS.PRESCRIBER_BY_DRUG,
      params
    );

    // Filter by state if specified
    if (state) {
      return results.filter(
        (p) => p.Prscrbr_State_Abrvtn.toUpperCase() === state.toUpperCase()
      );
    }

    return results;
  }

  /**
   * Get prescriber by NPI
   */
  async getPrescriberByNPI(npi: string): Promise<PrescriberByDrug[]> {
    return this.request<PrescriberByDrug>(DATASETS.PRESCRIBER_BY_DRUG, {
      keyword: npi,
      size: "100",
    });
  }

  /**
   * Raw API request for escape valve
   */
  async apiRequest(datasetId: string, params: Record<string, string> = {}): Promise<unknown> {
    return this.request(datasetId, params);
  }

  /**
   * Get dataset stats
   */
  async getDatasetStats(datasetId: string): Promise<unknown> {
    const url = `${CMS_BASE_URL}/${datasetId}/data/stats`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`CMS API error: ${response.status}`);
    }
    return response.json();
  }
}
