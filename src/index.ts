/**
 * Medicare Part D MCP Server - Cloudflare Workers Entry Point
 *
 * A Model Context Protocol (MCP) server for CMS Medicare Part D drug data.
 * Single tool with action dispatch for token efficiency.
 */

import { createMcpHandler } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CMSClient } from "./client";
import { handleAction } from "./handlers";
import { Env, SERVER_NAME, SERVER_VERSION, PartDParams } from "./types";

/**
 * Create MCP server with single tool configured
 */
function createServer() {
  const server = new McpServer({
    name: SERVER_NAME,
    version: SERVER_VERSION,
  });

  const client = new CMSClient();

  // Single tool with action dispatch
  server.tool("partd", PartDParams.shape, async (args) => {
    const params = PartDParams.parse(args);
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
      description: "Medicare Part D Drug Spending & Prescriber Data MCP Server",
      endpoints: {
        mcp: "/mcp",
        health: "/health",
      },
      tool: {
        name: "partd",
        actions: ["drug", "spending", "prescribers", "top", "search", "api", "help"],
      },
      data: {
        source: "CMS data.cms.gov",
        quarterly: "2024 Q1-Q4",
        annual: "2019-2023",
      },
      documentation: "https://data.cms.gov/tools/medicare-part-d-drug-spending-dashboard",
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
      return handler(request, env, ctx);
    }

    return new Response("Not Found", { status: 404 });
  },
};
