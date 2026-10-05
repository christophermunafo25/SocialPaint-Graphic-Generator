import React, { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SaveToLibrary, type EditorSaveToLibrary } from "./EditorPanel";

function Harness({ onOpenBuilder }: { onOpenBuilder(): void }) {
  const [state, setState] = useState<EditorSaveToLibrary["state"]>("idle");
  return (
    <>
      <SaveToLibrary
        state={state}
        error={state === "error" ? "We couldn't save this design." : undefined}
        onSave={() => setState("busy")}
        onOpenBuilder={onOpenBuilder}
      />
      <button type="button" onClick={() => setState("saved")}>
        land
      </button>
      <button type="button" onClick={() => setState("error")}>
        fail
      </button>
    </>
  );
}

describe("SaveToLibrary (Generate's editor, PHASE-5 §9 D8)", () => {
  it("saves once, then offers the builder; a failure says so and keeps the button", async () => {
    const openBuilder = vi.fn();
    render(<Harness onOpenBuilder={openBuilder} />);
    const save = screen.getByRole("button", { name: "Save to library" });
    await userEvent.click(save);
    const busy = screen.getByRole("button", { name: "Saving…" });
    expect(busy.getAttribute("aria-busy")).toBe("true");
    expect(busy.getAttribute("aria-disabled")).toBe("true");

    await userEvent.click(screen.getByRole("button", { name: "fail" }));
    expect(screen.getByRole("alert").textContent).toBe("We couldn't save this design.");
    expect(screen.getByRole("button", { name: "Save to library" })).toBeTruthy();

    await userEvent.click(screen.getByRole("button", { name: "land" }));
    expect(screen.getByRole("status").textContent).toBe("Saved to Brand Templates.");
    await userEvent.click(screen.getByRole("button", { name: "Open in the builder" }));
    expect(openBuilder).toHaveBeenCalledOnce();
  });
});
