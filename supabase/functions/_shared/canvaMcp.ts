// Minimal MCP client for Canva — JSON-RPC 2.0 over Streamable HTTP against
// https://mcp.canva.com/mcp. Exactly two tools are used: `read-design` (with
// a transaction open, which is what makes the full CDF with [locator_id]
// annotations appear — a plain read returns readable text only) and
// `export-design` (PNG for the background). Nothing else is implemented:
// no editing, no generation, no autofill.

const MCP_URL = "https://mcp.canva.com/mcp";

interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: number;
  result?: unknown;
  error?: { code: number; message: string };
}

export class CanvaMcpClient {
  private sessionId: string | null = null;
  private nextId = 1;

  constructor(private readonly accessToken: string) {}

  /** POST one JSON-RPC message. Streamable HTTP may answer as plain JSON or
   * as an SSE stream carrying JSON-RPC messages; both are handled. */
  private async rpc(method: string, params: unknown): Promise<unknown> {
    const id = this.nextId++;
    const res = await fetch(MCP_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        ...(this.sessionId ? { "Mcp-Session-Id": this.sessionId } : {}),
      },
      body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
    });
    const session = res.headers.get("Mcp-Session-Id");
    if (session) this.sessionId = session;
    if (!res.ok) {
      throw new Error(`Canva MCP ${method} failed (${res.status}).`);
    }

    const contentType = res.headers.get("Content-Type") ?? "";
    let message: JsonRpcResponse | undefined;
    if (contentType.includes("text/event-stream")) {
      // Read SSE frames until the response for our id arrives.
      const text = await res.text();
      for (const frame of text.split("\n\n")) {
        const data = frame
          .split("\n")
          .filter((l) => l.startsWith("data:"))
          .map((l) => l.slice(5).trim())
          .join("");
        if (!data) continue;
        try {
          const parsed = JSON.parse(data) as JsonRpcResponse;
          if (parsed.id === id) {
            message = parsed;
            break;
          }
        } catch {
          // non-JSON keepalive frame — skip
        }
      }
    } else {
      message = (await res.json()) as JsonRpcResponse;
    }

    if (!message) throw new Error(`Canva MCP ${method}: no response message.`);
    if (message.error) throw new Error(`Canva MCP ${method}: ${message.error.message}`);
    return message.result;
  }

  async initialize(): Promise<void> {
    await this.rpc("initialize", {
      protocolVersion: "2025-03-26",
      clientInfo: { name: "socialpaint-autobuild", version: "1.0" },
      capabilities: {},
    });
    // Per the MCP lifecycle, notify initialized (no response expected — a 202
    // or empty body is fine, so errors here are non-fatal).
    try {
      await fetch(MCP_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          "Content-Type": "application/json",
          Accept: "application/json, text/event-stream",
          ...(this.sessionId ? { "Mcp-Session-Id": this.sessionId } : {}),
        },
        body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }),
      });
    } catch {
      // best-effort
    }
  }

  private async callTool(name: string, args: unknown): Promise<Record<string, unknown>> {
    const result = (await this.rpc("tools/call", { name, arguments: args })) as {
      content?: Array<{ type: string; text?: string }>;
      structuredContent?: Record<string, unknown>;
      isError?: boolean;
    };
    if (result.isError) {
      const text = result.content?.find((c) => c.type === "text")?.text ?? "unknown error";
      throw new Error(`Canva ${name}: ${text}`);
    }
    if (result.structuredContent) return result.structuredContent;
    // Fall back to the first text block as JSON.
    const text = result.content?.find((c) => c.type === "text")?.text;
    if (!text) return {};
    try {
      return JSON.parse(text) as Record<string, unknown>;
    } catch {
      return { text };
    }
  }

  /** Full CDF read. The transaction is REQUIRED for locator ids; its id is
   * tracked so the session teardown doesn't leave it dangling. */
  async readDesign(designId: string): Promise<{ designContent: string; transactionId?: string }> {
    const out = await this.callTool("read-design", {
      design_id: designId,
      open_transaction: true,
      filter: { fields: ["design_metadata", "page_metadata", "design_content"] },
    });
    const designContent =
      (out.design_content as string | undefined) ??
      (out.designContent as string | undefined) ??
      (out.text as string | undefined) ??
      "";
    const transactionId =
      (out.transaction_id as string | undefined) ?? (out.transactionId as string | undefined);
    return { designContent, transactionId };
  }

  /** PNG export → the returned URL(s) are short-lived; caller re-hosts. */
  async exportDesign(designId: string): Promise<string> {
    const out = await this.callTool("export-design", {
      design_id: designId,
      format: "png",
    });
    const urls =
      (out.urls as string[] | undefined) ?? (typeof out.url === "string" ? [out.url] : undefined);
    const url = urls?.[0];
    if (!url) throw new Error("Canva export returned no file URL.");
    return url;
  }

  /** End the MCP session, which releases any open transaction server-side. */
  async close(): Promise<void> {
    if (!this.sessionId) return;
    try {
      await fetch(MCP_URL, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          "Mcp-Session-Id": this.sessionId,
        },
      });
    } catch {
      // best-effort teardown
    }
    this.sessionId = null;
  }
}

/** Parse a Canva design URL into its design id, with the host pinned to
 * canva.com — a canva.com-shaped path on some other host does not pass. */
export function parseCanvaUrl(url: string): { designId: string } | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  if (u.protocol !== "https:") return null;
  if (u.hostname !== "canva.com" && !u.hostname.endsWith(".canva.com")) return null;
  const m = u.pathname.match(/^\/design\/([A-Za-z0-9_-]+)(?:\/|$)/);
  return m ? { designId: m[1] } : null;
}
