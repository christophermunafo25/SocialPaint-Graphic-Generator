import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React, { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthContext, type AuthState } from "@/lib/auth/AuthContext";
import type { AutoBuildResult, Company, DesignImportResult } from "@/lib/types";
import { AutoBuildDialog } from "./AutoBuildDialog";
import { FigmaImportDialog } from "./FigmaImportDialog";

const designImport = vi.hoisted(() => ({
  isConnected: vi.fn(async () => true),
  canvaStatus: vi.fn(async () => ({ enabled: true, connected: true })),
  importFromUrl: vi.fn(),
  autoBuild: vi.fn(),
}));
vi.mock("@/lib/stores", () => ({ stores: { designImport } }));
const navigate = vi.hoisted(() => vi.fn());
vi.mock("../../router", () => ({
  useRouter: () => ({ route: { name: "adminTemplates" }, navigate }),
}));

const LINK = "https://www.figma.com/design/acme/Brand?node-id=1-2";

/** A promise the test settles by hand. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** The dialog as its opener holds it: mounted while open, gone on close. */
function Opener({ children }: { children(close: () => void): React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <AuthContext.Provider
      value={{ company: { id: "c1", name: "Acme" } as Company } as unknown as AuthState}
    >
      {open ? children(() => setOpen(false)) : <p>Closed</p>}
    </AuthContext.Provider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  designImport.isConnected.mockResolvedValue(true);
  designImport.canvaStatus.mockResolvedValue({ enabled: true, connected: true });
});

describe("Import from Figma (329:3710)", () => {
  function renderFigma(onImported = vi.fn()) {
    render(
      <Opener>{(close) => <FigmaImportDialog onClose={close} onImported={onImported} />}</Opener>,
    );
    return onImported;
  }

  it("imports the frame link and hands the result over", async () => {
    const result = { frameName: "Hiring" } as DesignImportResult;
    designImport.importFromUrl.mockResolvedValue(result);
    const onImported = renderFigma();
    await userEvent.type(await screen.findByLabelText("Frame link"), LINK);
    await waitFor(() =>
      expect((screen.getByRole("button", { name: "Import" }) as HTMLButtonElement).disabled).toBe(
        false,
      ),
    );
    await userEvent.click(screen.getByRole("button", { name: "Import" }));
    await waitFor(() => expect(onImported).toHaveBeenCalledWith(result));
    expect(designImport.importFromUrl).toHaveBeenCalledWith("c1", LINK);
  });

  it("drops the result when Cancel closes it mid-import", async () => {
    const pending = deferred<DesignImportResult>();
    designImport.importFromUrl.mockReturnValue(pending.promise);
    const onImported = renderFigma();
    await userEvent.type(await screen.findByLabelText("Frame link"), LINK);
    await waitFor(() =>
      expect((screen.getByRole("button", { name: "Import" }) as HTMLButtonElement).disabled).toBe(
        false,
      ),
    );
    await userEvent.click(screen.getByRole("button", { name: "Import" }));
    expect(await screen.findByRole("button", { name: "Importing…" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(await screen.findByText("Closed")).toBeTruthy();
    pending.resolve({ frameName: "Late" } as DesignImportResult);
    await pending.promise;
    expect(onImported).not.toHaveBeenCalled();
  });

  it("puts a failure under the link, focuses it and reads it out", async () => {
    designImport.importFromUrl.mockRejectedValue(new Error("That link isn't a frame."));
    renderFigma();
    const field = await screen.findByLabelText("Frame link");
    await userEvent.type(field, LINK);
    await waitFor(() =>
      expect((screen.getByRole("button", { name: "Import" }) as HTMLButtonElement).disabled).toBe(
        false,
      ),
    );
    await userEvent.click(screen.getByRole("button", { name: "Import" }));
    await waitFor(() => expect(field.getAttribute("aria-invalid")).toBe("true"));
    expect(document.activeElement).toBe(field);
    expect(screen.getByRole("alert").textContent).toBe("That link isn't a frame.");
  });

  it("says when the workspace hasn't connected Figma, and opens Integrations", async () => {
    designImport.isConnected.mockResolvedValue(false);
    renderFigma();
    expect(await screen.findByText("Your workspace hasn't connected Figma.")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Open settings" }));
    expect(navigate).toHaveBeenCalledWith({ name: "settings", section: "integrations" });
    expect(screen.getByText("Closed")).toBeTruthy();
  });
});

describe("Auto build (329:3981, 329:4286)", () => {
  function renderAuto(onBuilt = vi.fn()) {
    render(<Opener>{(close) => <AutoBuildDialog onClose={close} onBuilt={onBuilt} />}</Opener>);
    return onBuilt;
  }
  const sources = () =>
    screen
      .getAllByRole("radio")
      .map((r) => r.textContent)
      .filter(Boolean);

  it("offers a Canva link only when the plan has Canva", async () => {
    designImport.canvaStatus.mockResolvedValue({ enabled: false, connected: false });
    renderAuto();
    await waitFor(() => expect(sources()).toEqual(["Figma link", "Image"]));
  });

  it("shows its steps while it builds, with the focus on Cancel", async () => {
    designImport.autoBuild.mockReturnValue(new Promise(() => {}));
    renderAuto();
    await waitFor(() => expect(sources()).toEqual(["Figma link", "Canva link", "Image"]));
    await userEvent.type(screen.getByLabelText("Design link"), LINK);
    await userEvent.click(screen.getByRole("button", { name: "Build template" }));
    expect(await screen.findByText("1 of 3 · Reading the design")).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Cancel" }));
    expect(designImport.autoBuild).toHaveBeenCalledWith(
      "c1",
      { kind: "figma", url: LINK },
      undefined,
    );
  });

  it("drops the result when Cancel closes it mid-build", async () => {
    const pending = deferred<AutoBuildResult>();
    designImport.autoBuild.mockReturnValue(pending.promise);
    const onBuilt = renderAuto();
    await userEvent.type(await screen.findByLabelText("Design link"), LINK);
    await waitFor(() =>
      expect(
        (screen.getByRole("button", { name: "Build template" }) as HTMLButtonElement).disabled,
      ).toBe(false),
    );
    await userEvent.click(screen.getByRole("button", { name: "Build template" }));
    await userEvent.click(await screen.findByRole("button", { name: "Cancel" }));
    expect(await screen.findByText("Closed")).toBeTruthy();
    pending.resolve({} as AutoBuildResult);
    await pending.promise;
    expect(onBuilt).not.toHaveBeenCalled();
  });
});
