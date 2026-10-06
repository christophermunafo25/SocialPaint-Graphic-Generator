import { describe, expect, it } from "vitest";
import * as client from "./catalog";
import * as server from "../../../supabase/functions/_shared/billingCatalog";

describe("billing catalog (PHASE-7B.md §2)", () => {
  it("the client and the functions read the same plans", () => {
    expect(client.PLANS).toEqual(server.PLANS);
  });

  it("includes what CJ set: admins and brands per plan", () => {
    expect(client.PLANS.map((p) => [p.key, p.includedAdmins, p.includedBrands])).toEqual([
      ["canvas", 1, 1],
      ["studio", 1, 3],
      ["crew", 4, 3],
      ["portfolio", 10, 10],
    ]);
  });

  it("recognises plan keys", () => {
    expect(client.isPlanKey("crew")).toBe(true);
    expect(client.isPlanKey("enterprise")).toBe(false);
    expect(client.planInfo("studio").label).toBe("Studio");
  });
});
