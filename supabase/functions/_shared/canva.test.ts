import { describe, expect, it } from "vitest";
import { describeTokenFailure } from "./canva.ts";

describe("describeTokenFailure", () => {
  it("names the secret for invalid_client", () => {
    const msg = describeTokenFailure(
      400,
      '{"code":"invalid_client","message":"Client secret is invalid for OC-X"}',
    );
    expect(msg).toMatch(/client secret/);
    expect(msg).toMatch(/CANVA_CLIENT_SECRET/);
    expect(msg).not.toMatch(/OC-X/);
  });

  it("tells the admin to start again for invalid_grant", () => {
    expect(describeTokenFailure(400, '{"code":"invalid_grant","message":"x"}')).toMatch(
      /Start the connection again/,
    );
  });

  it("falls back to the status and code, with or without a JSON body", () => {
    expect(describeTokenFailure(401, '{"code":"unauthorized_client"}')).toMatch(
      /\(401, unauthorized_client\)/,
    );
    expect(describeTokenFailure(502, "<html>bad gateway</html>")).toMatch(/\(502\)/);
  });
});
