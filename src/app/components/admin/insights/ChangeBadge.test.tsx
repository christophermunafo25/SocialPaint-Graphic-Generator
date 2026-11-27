import React from "react";
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import type { InsightChange } from "@/lib/insights/buildInsights";
import { ChangeBadge } from "./ChangeBadge";

const CHANGES: InsightChange[] = [
  { direction: "up", percent: 18 },
  { direction: "down", percent: 4 },
  { direction: "up", delta: 5 },
  { direction: "flat", percent: 0 },
  { direction: "new" },
];

describe("ChangeBadge", () => {
  it("is Neutral for every change, whatever the direction", () => {
    for (const change of CHANGES) {
      const { container, unmount } = render(<ChangeBadge change={change} />);
      const badge = container.querySelector(".ui-badge") as HTMLElement;
      expect(badge.dataset.tone).toBe("neutral");
      unmount();
    }
  });

  it("keeps its arrow on screen and its words for assistive tech", () => {
    const { container } = render(<ChangeBadge change={{ direction: "up", percent: 18 }} />);
    const [chip, words] = Array.from(container.querySelectorAll(".ui-badge span span"));
    expect(chip.textContent).toBe("↗ 18%");
    expect(chip.getAttribute("aria-hidden")).toBe("true");
    expect(words.className).toBe("sr-only");
    expect(words.textContent).toBe("Up 18%");
  });
});
