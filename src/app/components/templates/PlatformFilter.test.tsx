import React, { useState } from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { buildPlatformFacets } from "@/lib/templates/groups";
import { platformById, type PlatformId } from "@/lib/templates/platforms";
import { PlatformFilter } from "./PlatformFilter";

const facets = (["linkedin", "instagram"] as PlatformId[]).map((id) => ({
  platform: platformById(id),
  count: 1,
})) as ReturnType<typeof buildPlatformFacets>;

function Harness() {
  const [selected, setSelected] = useState<PlatformId | null>(null);
  return <PlatformFilter facets={facets} selected={selected} onSelect={setSelected} />;
}

describe("PlatformFilter", () => {
  it("is a radio group with one tab stop that arrows select through", async () => {
    render(<Harness />);
    const all = screen.getByRole("radio", { name: "All" });
    expect(all.getAttribute("aria-checked")).toBe("true");
    expect(screen.getAllByRole("radio").filter((r) => r.tabIndex === 0)).toHaveLength(1);

    await userEvent.tab();
    expect(document.activeElement).toBe(all);
    await userEvent.keyboard("{ArrowRight}");
    const linkedin = screen.getByRole("radio", { name: "LinkedIn" });
    expect(document.activeElement).toBe(linkedin);
    expect(linkedin.getAttribute("aria-checked")).toBe("true");

    await userEvent.keyboard("{End}");
    expect(screen.getByRole("radio", { name: "Instagram" }).getAttribute("aria-checked")).toBe(
      "true",
    );
    await userEvent.keyboard("{Home}");
    expect(all.getAttribute("aria-checked")).toBe("true");
  });
});
