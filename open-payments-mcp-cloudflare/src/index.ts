/**
 * Open Payments MCP Server - Cloudflare Workers Entry Point
 *
 * A Model Context Protocol (MCP) server for CMS Open Payments data.
 * Single tool with action dispatch for token efficiency.
 */

import { createMcpHandler } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { OpenPaymentsClient } from "./client";
import { handleAction } from "./handlers";
import { Env, SERVER_NAME, SERVER_VERSION, OpenPaymentsParams } from "./types";

/**
 * Create MCP server with single tool configured
 */
function createServer() {
  const server = new McpServer({
    name: SERVER_NAME,
    version: SERVER_VERSION,
  });

  const client = new OpenPaymentsClient();

  // Single tool with action dispatch
  server.tool("openpayments", OpenPaymentsParams.shape, async (args) => {
    const params = OpenPaymentsParams.parse(args);
    return handleAction(params, client);
  });

  return server;
}

/**
 * Health endpoint response
 */
function healthResponse(): Response {
  return new Response(
    JSON.stringify({
      status: "healthy",
      server: SERVER_NAME,
      version: SERVER_VERSION,
      description: "CMS Open Payments (Sunshine Act) MCP Server",
      endpoints: {
        mcp: "/mcp",
        health: "/health",
      },
      tool: {
        name: "openpayments",
        actions: [
          "search", "physician", "company",
          "top_recipients", "top_payers", "payment_types",
          "specialty", "state", "summary",
          "api", "help",
        ],
      },
      data: {
        source: "openpaymentsdata.cms.gov",
        program_year: "2023",
        type: "General Payments",
      },
      documentation: "https://www.cms.gov/priorities/key-initiatives/open-payments",
    }),
    {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    }
  );
}

/**
 * Main Cloudflare Worker fetch handler
 */
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Health check endpoint
    if (url.pathname === "/health" || url.pathname === "/") {
      return healthResponse();
    }

    // MCP endpoint - streamable HTTP transport
    if (url.pathname === "/mcp") {
      const server = createServer();
      const handler = createMcpHandler(server);
      const response = await handler(request, env, ctx);

      // Open Payments data updates annually; cache for 1 hour
      response.headers.set("Cache-Control", "public, max-age=3600");

      return response;
    }

    return new Response("Not Found", { status: 404 });
  },
};
