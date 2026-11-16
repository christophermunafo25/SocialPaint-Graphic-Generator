import React, { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { DetailTagValue } from "@/lib/generate/details";
import type { PlatformId } from "@/lib/templates/platforms";
import { ChatComposer } from "./ChatComposer";

vi.mock("@/lib/brand/BrandContext", () => ({ useBrand: () => ({ assets: [] }) }));
vi.mock("../ImageSourceChooser", () => ({
  ImageSourceDialog: () => null,
  pickableAssets: () => [],
}));

const LOCATION: DetailTagValue = {
  fieldKey: "place",
  label: "Location",
  value: "Remote",
  kind: "place",
} as DetailTagValue;

/** The page's model: a platform picked for the next message, or none
 * (undefined), when the last send's (`reused`) shows instead. */
function Harness({
  reused = null,
  initial,
  details = [],
}: {
  reused?: PlatformId | null;
  initial?: PlatformId | null;
  details?: DetailTagValue[];
}) {
  const [picked, setPicked] = useState<PlatformId | null | undefined>(initial);
  const [text, setText] = useState("");
  return (
    <>
      <ChatComposer
        value={text}
        onChange={setText}
        photo={null}
        onPhotoChange={() => {}}
        running={false}
        onSubmit={() => {}}
        onStop={() => {}}
        placeholder="Describe the post"
        platform={{
          value: picked !== undefined ? picked : reused,
          chosen: picked !== undefined,
          onChange: setPicked,
          onReset: () => setPicked(undefined),
        }}
        details={{ value: details, onChange: () => {} }}
      />
      <output data-testid="picked">{String(picked)}</output>
    </>
  );
}

const tagNames = () =>
  screen.queryAllByRole("button", { name: /^Edit / }).map((b) => b.getAttribute("aria-label"));

describe("ChatComposer's platform", () => {
  it("shows a picked platform as the Details row's first tag, and a reused one in the menu alone", async () => {
    const { unmount } = render(<Harness reused="linkedin" />);
    expect(tagNames()).toEqual([]);
    await userEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(screen.getAllByRole("menuitem")[0].textContent).toBe("PlatformLinkedIn");
    unmount();

    render(<Harness initial="instagram" details={[LOCATION]} />);
    expect(tagNames()).toEqual(["Edit platform: Instagram", "Edit Location: Remote"]);
  });

  it("takes the pick back from the tag's x, with focus in the text", async () => {
    render(<Harness initial="instagram" reused="linkedin" />);
    await userEvent.click(screen.getByRole("button", { name: "Remove Instagram" }));
    expect(screen.getByTestId("picked").textContent).toBe("undefined");
    expect(tagNames()).toEqual([]);
    expect(document.activeElement).toBe(screen.getByRole("textbox", { name: "Describe the post" }));
  });

  it("reopens the list from the tag, and Any leaves focus on the plus as the tag goes", async () => {
    render(<Harness initial="instagram" />);
    const tag = screen.getByRole("button", { name: "Edit platform: Instagram" });
    await userEvent.click(tag);
    expect(document.activeElement).toBe(screen.getByRole("menuitemradio", { name: "Instagram" }));

    await userEvent.click(screen.getByRole("menuitemradio", { name: "LinkedIn" }));
    const moved = screen.getByRole("button", { name: "Edit platform: LinkedIn" });
    expect(document.activeElement).toBe(moved);

    await userEvent.click(moved);
    await userEvent.keyboard("{Home}{Enter}");
    expect(screen.getByTestId("picked").textContent).toBe("null");
    expect(tagNames()).toEqual([]);
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Add" }));
  });
});
