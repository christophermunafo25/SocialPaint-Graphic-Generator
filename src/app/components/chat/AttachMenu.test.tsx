import React, { useRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { upsertDetail, type DetailTagValue } from "@/lib/generate/details";
import type { PlatformId } from "@/lib/templates/platforms";
import { AttachMenu, type AttachMenuHandle } from "./AttachMenu";

vi.mock("@/lib/brand/BrandContext", () => ({ useBrand: () => ({ assets: [] }) }));
vi.mock("../ImageSourceChooser", () => ({
  ImageSourceDialog: () => null,
  pickableAssets: () => [],
}));

function Harness({
  withDetails = true,
  withPlatform = false,
}: {
  withDetails?: boolean;
  withPlatform?: boolean;
}) {
  const [tags, setTags] = useState<DetailTagValue[]>([]);
  const [platform, setPlatform] = useState<PlatformId | null>(null);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const menu = useRef<AttachMenuHandle>(null);
  return (
    <div ref={box}>
      <AttachMenu
        ref={menu}
        containerRef={box}
        onPickFile={() => {}}
        onPickDocument={() => {}}
        onPickAsset={() => {}}
        onOpenChange={setOpen}
        platform={withPlatform ? { value: platform, onChange: setPlatform } : undefined}
        details={
          withDetails
            ? { value: tags, onSet: (kind, v) => setTags((t) => upsertDetail(t, kind, v)) }
            : undefined
        }
      />
      <output data-testid="open">{String(open)}</output>
      <output data-testid="platform">{String(platform)}</output>
      <button type="button" onClick={(e) => menu.current?.editPlatform(e.currentTarget)}>
        Platform tag
      </button>
      <ul>
        {tags.map((t) => (
          <li key={t.fieldKey}>
            <button
              type="button"
              onClick={(e) => menu.current?.editDetail(t.fieldKey, e.currentTarget)}
            >
              {`${t.label}: ${t.value}`}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

describe("AttachMenu", () => {
  it("is Upload only without details, behind the Add tooltip's name", async () => {
    render(<Harness withDetails={false} />);
    await userEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(screen.getAllByRole("menuitem").map((el) => el.textContent)).toEqual(["Photo", "File"]);
    expect(screen.getByTestId("open").textContent).toBe("true");
  });

  it("adds a detail from its row, edits it from its tag, and keeps one per kind", async () => {
    render(<Harness />);
    const plus = screen.getByRole("button", { name: "Add" });
    await userEvent.click(plus);
    expect(screen.getAllByRole("menuitem").map((el) => el.textContent)).toEqual([
      "Photo",
      "File",
      "Headline",
      "Date & time",
      "Location",
      "Link",
    ]);
    await userEvent.click(screen.getByRole("menuitem", { name: "Date & time" }));

    // The panel replaces the menu, focus in its input; empty can't be added.
    expect(screen.queryByRole("menu")).toBeNull();
    const input = screen.getByRole("textbox", { name: "Date & time" });
    expect(document.activeElement).toBe(input);
    const addButton = () =>
      screen.getAllByRole("button", { name: "Add" }).find((b) => b !== plus) as HTMLButtonElement;
    expect(addButton().disabled).toBe(true);

    await userEvent.type(input, "Oct 31, 5:00 PM{Enter}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(plus);
    const tag = screen.getByRole("button", { name: "Date & time: Oct 31, 5:00 PM" });

    // The tag opens the panel filled in; Add replaces the value in place.
    await userEvent.click(tag);
    const again = screen.getByRole("textbox", { name: "Date & time" }) as HTMLInputElement;
    expect(again.value).toBe("Oct 31, 5:00 PM");
    await userEvent.clear(again);
    await userEvent.type(again, "Nov 1{Enter}");
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    const edited = screen.getByRole("button", { name: "Date & time: Nov 1" });
    expect(document.activeElement).toBe(edited);
  });

  it("goes Back to the menu on the detail's row, and Escape returns to the plus", async () => {
    render(<Harness />);
    const plus = screen.getByRole("button", { name: "Add" });
    await userEvent.click(plus);
    await userEvent.click(screen.getByRole("menuitem", { name: "Link" }));
    await userEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(document.activeElement).toBe(screen.getByRole("menuitem", { name: "Link" }));
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).toBeNull();
    expect(document.activeElement).toBe(plus);
    expect(screen.getByTestId("open").textContent).toBe("false");
  });

  it("leads with Output, and picks a platform from its list", async () => {
    render(<Harness withPlatform />);
    const plus = screen.getByRole("button", { name: "Add" });
    await userEvent.click(plus);
    const rows = screen.getAllByRole("menuitem");
    expect(rows.map((el) => el.textContent)).toEqual([
      "PlatformAny",
      "Photo",
      "File",
      "Headline",
      "Date & time",
      "Location",
      "Link",
    ]);
    expect(screen.getByRole("group", { name: "Output" })).toBeTruthy();
    await userEvent.click(rows[0]);

    // The list replaces the menu, on the platform picked (Any).
    const any = screen.getByRole("menuitemradio", { name: "Any" });
    expect(any.getAttribute("aria-checked")).toBe("true");
    expect(document.activeElement).toBe(any);
    await userEvent.keyboard("{ArrowDown}");
    expect(document.activeElement).toBe(screen.getByRole("menuitemradio", { name: "LinkedIn" }));

    await userEvent.click(screen.getByRole("menuitemradio", { name: "Instagram" }));
    expect(screen.getByTestId("platform").textContent).toBe("instagram");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(plus);

    await userEvent.click(plus);
    expect(screen.getAllByRole("menuitem")[0].textContent).toBe("PlatformInstagram");
  });

  it("opens the list from the platform's tag, and Tab moves between Back and the list", async () => {
    render(<Harness withPlatform />);
    const tag = screen.getByRole("button", { name: "Platform tag" });
    await userEvent.click(tag);
    const back = screen.getByRole("button", { name: "Back" });
    await userEvent.keyboard("{Shift>}{Tab}{/Shift}");
    expect(document.activeElement).toBe(back);
    await userEvent.keyboard("{Tab}");
    expect(document.activeElement).toBe(screen.getByRole("menuitemradio", { name: "Any" }));

    // Back lands on the Platform row; Escape from the list returns to the tag.
    await userEvent.click(back);
    expect(document.activeElement).toBe(screen.getByRole("menuitem", { name: "Platform Any" }));
    await userEvent.keyboard("{Enter}");
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Add" }));

    await userEvent.click(tag);
    await userEvent.keyboard("{Escape}");
    expect(document.activeElement).toBe(tag);
  });

  it("moves from Back into the list with the arrows, Home and End", async () => {
    render(<Harness withPlatform />);
    await userEvent.click(screen.getByRole("button", { name: "Platform tag" }));
    const radios = () => screen.getAllByRole("menuitemradio");
    const back = screen.getByRole("button", { name: "Back" });
    for (const [key, at] of [
      ["{ArrowDown}", 0],
      ["{ArrowUp}", -1],
      ["{End}", -1],
      ["{Home}", 0],
    ] as const) {
      back.focus();
      await userEvent.keyboard(key);
      const list = radios();
      expect(document.activeElement).toBe(list[at < 0 ? list.length + at : at]);
    }
  });
});
