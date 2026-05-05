/**
 * Drug Reference MCP Server - Multi-Source API Client
 *
 * Queries three APIs:
 * - RxNorm (rxnav.nlm.nih.gov/REST) — drug identity, NDC mapping
 * - openFDA FAERS (api.fda.gov/drug/event.json) — adverse events
 * - openFDA NDC/Label/Enforcement (api.fda.gov/drug/*) — product info, labels, recalls
 *
 * All free, no API key required.
 */

import {
  RXNORM_BASE,
  OPENFDA_BASE,
  RxDrugGroup,
  FDACountResult,
  FDANDCProduct,
  FDALabel,
  FDAEnforcement,
  FDAAdverseEvent,
} from "./types";

export class DrugClient {
  // ─── RxNorm methods ────────────────────────────────────

  /**
   * Search drugs by name → returns RxCUI identifiers and concept info
   */
  async searchDrug(name: string): Promise<RxDrugGroup> {
    const url = `${RXNORM_BASE}/drugs.json?name=${encodeURIComponent(name)}`;
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`RxNorm API error: ${res.status}`);
    const data = await res.json() as { drugGroup: RxDrugGroup };
    return data.drugGroup;
  }

  /**
   * Get RxCUI from NDC code
   */
  async rxcuiFromNDC(ndc: string): Promise<string | null> {
    const url = `${RXNORM_BASE}/rxcui.json?idtype=NDC&id=${encodeURIComponent(ndc)}`;
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    const data = await res.json() as { idGroup?: { rxnormId?: string[] } };
    return data.idGroup?.rxnormId?.[0] || null;
  }

  /**
   * Get all NDCs for an RxCUI
   */
  async getNDCsForRxCUI(rxcui: string): Promise<string[]> {
    const url = `${RXNORM_BASE}/rxcui/${rxcui}/ndcs.json`;
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return [];
    const data = await res.json() as { ndcGroup?: { ndcList?: { ndc?: string[] } } };
    return data.ndcGroup?.ndcList?.ndc || [];
  }

  /**
   * Get all related concepts for an RxCUI (ingredients, brands, generics, dose forms)
   */
  async getAllRelated(rxcui: string): Promise<unknown> {
    const url = `${RXNORM_BASE}/rxcui/${rxcui}/allrelated.json`;
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`RxNorm API error: ${res.status}`);
    return res.json();
  }

  /**
   * Get drug properties by RxCUI
   */
  async getRxProperties(rxcui: string): Promise<unknown> {
    const url = `${RXNORM_BASE}/rxcui/${rxcui}/properties.json`;
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    return res.json();
  }

  /**
   * Approximate term search (spelling suggestions)
   */
  async approximateSearch(term: string): Promise<unknown> {
    const url = `${RXNORM_BASE}/approximateTerm.json?term=${encodeURIComponent(term)}&maxEntries=10`;
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    return res.json();
  }

  // ─── openFDA methods ───────────────────────────────────

  /**
   * Get top adverse reactions for a drug (count endpoint)
   */
  async getAdverseReactions(drugName: string, limit: number = 20): Promise<FDACountResult[]> {
    const url = `${OPENFDA_BASE}/event.json?search=patient.drug.openfda.brand_name.exact:"${encodeURIComponent(drugName)}"&count=patient.reaction.reactionmeddrapt.exact&limit=${limit}`;
    const res = await fetch(url);
    if (!res.ok) {
      // Try generic name
      const url2 = `${OPENFDA_BASE}/event.json?search=patient.drug.openfda.generic_name.exact:"${encodeURIComponent(drugName)}"&count=patient.reaction.reactionmeddrapt.exact&limit=${limit}`;
      const res2 = await fetch(url2);
      if (!res2.ok) return [];
      const data2 = await res2.json() as { results?: FDACountResult[] };
      return data2.results || [];
    }
    const data = await res.json() as { results?: FDACountResult[] };
    return data.results || [];
  }

  /**
   * Get adverse event seriousness breakdown for a drug
   */
  async getAdverseSeriousness(drugName: string): Promise<{ total: number; serious: number; deaths: number; hospitalizations: number }> {
    const baseSearch = `patient.drug.openfda.brand_name.exact:"${encodeURIComponent(drugName)}"`;

    const [totalRes, seriousRes, deathRes, hospRes] = await Promise.all([
      fetch(`${OPENFDA_BASE}/event.json?search=${baseSearch}&limit=1`),
      fetch(`${OPENFDA_BASE}/event.json?search=${baseSearch}+AND+serious:1&limit=1`),
      fetch(`${OPENFDA_BASE}/event.json?search=${baseSearch}+AND+seriousnessdeath:1&limit=1`),
      fetch(`${OPENFDA_BASE}/event.json?search=${baseSearch}+AND+seriousnesshospitalization:1&limit=1`),
    ]);

    const extractTotal = async (res: Response): Promise<number> => {
      if (!res.ok) return 0;
      const data = await res.json() as { meta?: { results?: { total?: number } } };
      return data.meta?.results?.total || 0;
    };

    return {
      total: await extractTotal(totalRes),
      serious: await extractTotal(seriousRes),
      deaths: await extractTotal(deathRes),
      hospitalizations: await extractTotal(hospRes),
    };
  }

  /**
   * Look up NDC product info
   */
  async getNDCProduct(query: string, limit: number = 10): Promise<FDANDCProduct[]> {
    // Try as NDC code first, then as brand name
    let url = `${OPENFDA_BASE}/ndc.json?search=product_ndc:"${encodeURIComponent(query)}"&limit=${limit}`;
    let res = await fetch(url);

    if (!res.ok) {
      url = `${OPENFDA_BASE}/ndc.json?search=brand_name:"${encodeURIComponent(query)}"&limit=${limit}`;
      res = await fetch(url);
      if (!res.ok) return [];
    }

    const data = await res.json() as { results?: FDANDCProduct[] };
    return data.results || [];
  }

  /**
   * Get drug label/prescribing information
   */
  async getDrugLabel(drugName: string): Promise<FDALabel | null> {
    const url = `${OPENFDA_BASE}/label.json?search=openfda.brand_name:"${encodeURIComponent(drugName)}"&limit=1`;
    const res = await fetch(url);

    if (!res.ok) {
      // Try generic name
      const url2 = `${OPENFDA_BASE}/label.json?search=openfda.generic_name:"${encodeURIComponent(drugName)}"&limit=1`;
      const res2 = await fetch(url2);
      if (!res2.ok) return null;
      const data2 = await res2.json() as { results?: FDALabel[] };
      return data2.results?.[0] || null;
    }

    const data = await res.json() as { results?: FDALabel[] };
    return data.results?.[0] || null;
  }

  /**
   * Get drug recalls/enforcement actions
   */
  async getDrugRecalls(drugName: string, limit: number = 10): Promise<FDAEnforcement[]> {
    const url = `${OPENFDA_BASE}/enforcement.json?search=openfda.brand_name:"${encodeURIComponent(drugName)}"&limit=${limit}&sort=recall_initiation_date:desc`;
    const res = await fetch(url);

    if (!res.ok) {
      // Try product description search
      const url2 = `${OPENFDA_BASE}/enforcement.json?search=product_description:"${encodeURIComponent(drugName)}"&limit=${limit}&sort=recall_initiation_date:desc`;
      const res2 = await fetch(url2);
      if (!res2.ok) return [];
      const data2 = await res2.json() as { results?: FDAEnforcement[] };
      return data2.results || [];
    }

    const data = await res.json() as { results?: FDAEnforcement[] };
    return data.results || [];
  }
}
