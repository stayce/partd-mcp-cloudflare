/**
 * Drug Reference MCP Server - Cloudflare Workers Entry Point
 *
 * Unified drug intelligence: RxNorm + openFDA (FAERS, NDC, Labels, Recalls)
 * Single tool with action dispatch for token efficiency.
 */

import { createMcpHandler } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { DrugClient } from "./client";
import { handleAction } from "./handlers";
import { Env, SERVER_NAME, SERVER_VERSION, DrugParams } from "./types";

function createServer() {
  const server = new McpServer({
    name: SERVER_NAME,
    version: SERVER_VERSION,
  });

  const client = new DrugClient();

  server.tool("drug", DrugParams.shape, async (args) => {
    const params = DrugParams.parse(args);
    return handleAction(params, client);
  });

  return server;
}

function healthResponse(): Response {
  return new Response(
    JSON.stringify({
      status: "healthy",
      server: SERVER_NAME,
      version: SERVER_VERSION,
      description: "Unified Drug Reference MCP Server (RxNorm + openFDA)",
      endpoints: { mcp: "/mcp", health: "/health" },
      tool: {
        name: "drug",
        actions: [
          "search", "ndc", "adverse_events", "label",
          "recalls", "rxnorm", "crossref", "api", "help",
        ],
      },
      sources: {
        rxnorm: "rxnav.nlm.nih.gov",
        openfda_faers: "api.fda.gov/drug/event.json",
        openfda_ndc: "api.fda.gov/drug/ndc.json",
        openfda_label: "api.fda.gov/drug/label.json",
        openfda_recalls: "api.fda.gov/drug/enforcement.json",
      },
    }),
    {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    }
  );
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/health" || url.pathname === "/") {
      return healthResponse();
    }

    if (url.pathname === "/mcp") {
      const server = createServer();
      const handler = createMcpHandler(server);
      const response = await handler(request, env, ctx);
      // Drug data changes infrequently; cache 1 hour
      response.headers.set("Cache-Control", "public, max-age=3600");
      return response;
    }

    return new Response("Not Found", { status: 404 });
  },
};
