/**
 * Medicare Part D MCP Server - CMS Data API Client
 */

import {
  DATASETS,
  DrugSpendingQuarterly,
  DrugSpendingAnnual,
  PrescriberByDrug,
  PrescriberByGeo,
  PrescriberByProvider,
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
   * Get top drugs with flexible sort criteria
   */
  async getTopDrugs(
    sortBy: "spending" | "beneficiaries" | "claims" = "spending",
    maxResults: number = 25
  ): Promise<DrugSpendingQuarterly[]> {
    const results = await this.request<DrugSpendingQuarterly>(
      DATASETS.SPENDING_QUARTERLY,
      { size: String(maxResults * 2) }
    );

    const sortField: Record<string, keyof DrugSpendingQuarterly> = {
      spending: "Tot_Spndng",
      beneficiaries: "Tot_Benes",
      claims: "Tot_Clms",
    };

    const field = sortField[sortBy];

    return results
      .filter((d) => d.Mftr_Name === "Overall")
      .sort((a, b) => parseFloat(b[field]) - parseFloat(a[field]))
      .slice(0, maxResults);
  }

  /**
   * Get prescriber data by geography
   */
  async getPrescribersByGeo(
    drugName?: string,
    state?: string,
    maxResults: number = 25
  ): Promise<PrescriberByGeo[]> {
    const params: Record<string, string> = {
      size: String(maxResults),
    };
    if (drugName) {
      params.keyword = drugName;
    }

    const results = await this.request<PrescriberByGeo>(
      DATASETS.PRESCRIBER_BY_GEO,
      params
    );

    if (state) {
      return results.filter(
        (r) =>
          (r.Prscrbr_Geo_Cd && r.Prscrbr_Geo_Cd.toUpperCase() === state.toUpperCase()) ||
          (r.Prscrbr_Geo_Desc && r.Prscrbr_Geo_Desc.toUpperCase().includes(state.toUpperCase()))
      );
    }

    return results;
  }

  /**
   * Get drugs by manufacturer name
   */
  async getDrugsByManufacturer(
    manufacturer: string,
    maxResults: number = 25
  ): Promise<DrugSpendingQuarterly[]> {
    const results = await this.request<DrugSpendingQuarterly>(
      DATASETS.SPENDING_QUARTERLY,
      { keyword: manufacturer, size: String(maxResults * 2) }
    );

    return results
      .filter(
        (d) =>
          d.Mftr_Name.toUpperCase().includes(manufacturer.toUpperCase()) &&
          d.Mftr_Name !== "Overall"
      )
      .slice(0, maxResults);
  }

  /**
   * Get annual spending data for outlier detection (large batch)
   */
  async getAnnualOutliers(maxResults: number = 50): Promise<DrugSpendingAnnual[]> {
    const results = await this.request<DrugSpendingAnnual>(
      DATASETS.SPENDING_ANNUAL,
      { size: String(maxResults * 3) }
    );

    return results.filter((d) => d.Mftr_Name === "Overall");
  }

  /**
   * Search for drugs by generic name to find alternatives
   */
  async getGenericAlternatives(
    genericName: string,
    maxResults: number = 25
  ): Promise<DrugSpendingQuarterly[]> {
    const results = await this.request<DrugSpendingQuarterly>(
      DATASETS.SPENDING_QUARTERLY,
      { keyword: genericName, size: String(maxResults * 2) }
    );

    return results.filter((d) => d.Mftr_Name === "Overall");
  }

  /**
   * Get prescribers by specialty for a drug
   */
  async getPrescribersBySpecialty(
    drugName: string,
    specialty?: string,
    maxResults: number = 100
  ): Promise<PrescriberByDrug[]> {
    const results = await this.request<PrescriberByDrug>(
      DATASETS.PRESCRIBER_BY_DRUG,
      { keyword: drugName, size: String(maxResults) }
    );

    if (specialty) {
      return results.filter(
        (p) => p.Prscrbr_Type.toUpperCase().includes(specialty.toUpperCase())
      );
    }

    return results;
  }

  /**
   * Get provider data from prescriber-by-provider dataset
   */
  async getProviderByNPI(npi: string): Promise<PrescriberByProvider[]> {
    return this.request<PrescriberByProvider>(DATASETS.PRESCRIBER_BY_PROVIDER, {
      keyword: npi,
      size: "10",
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
