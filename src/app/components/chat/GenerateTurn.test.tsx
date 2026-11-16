import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { GeneratedProposal, TemplateField, TemplateSchema } from "@/lib/types";
import type { AssistantTurn, ChatDraft, ChatThread } from "@/lib/generate/chat";
import { chatReducer, emptyThread, type ChatAction } from "@/lib/generate/chatReducer";
import { GenerateTurn, downloadAllLabel } from "./GenerateTurn";

vi.mock("@/lib/brand/BrandContext", () => ({ useBrand: () => ({ kit: null, assets: [] }) }));
vi.mock("../TemplateThumbnail", () => ({
  TemplateThumbnail: ({ template }: { template: TemplateSchema }) => (
    <span data-testid="art">{template.name}</span>
  ),
}));

const T0 = "2026-11-16T10:00:00.000Z";

const FIELDS: TemplateField[] = [
  {
    id: "headline",
    label: "Headline",
    fieldKey: "headline",
    type: "text",
    x: 0,
    y: 0,
    width: 400,
    height: 100,
  },
];

const schema = (id: string, name: string, width: number, height: number): TemplateSchema => ({
  id,
  companyId: "co-1",
  name,
  description: "",
  category: "",
  tags: [],
  status: "published",
  canvasWidth: width,
  canvasHeight: height,
  backgroundUrl: "",
  fields: FIELDS,
  captionTemplate: "{headline}",
  createdAt: T0,
  updatedAt: T0,
});

const proposal = (templateId: string, templateName: string): GeneratedProposal => ({
  templateId,
  templateName,
  values: { headline: `${templateName} now` },
  caption: `${templateName} caption`,
  why: "It fits.",
  imageFieldsNeeded: [],
});

const draft = (id: string, name: string, width: number, height: number): ChatDraft => {
  const s = schema(`tpl-${id}`, name, width, height);
  return {
    id,
    proposal: proposal(s.id, name),
    schema: s,
    canvas: { width, height },
    values: { headline: `${name} now` },
  };
};

const SQUARE = draft("d1", "Feature highlight", 1080, 1080);
const LINK = draft("d2", "Open role", 1200, 627);

const run = (...actions: ChatAction[]): ChatThread => actions.reduce(chatReducer, emptyThread(T0));

const sent: ChatAction = {
  type: "sent",
  runId: "run-1",
  userTurnId: "user-1",
  text: "We're hiring.",
  variations: 2,
  intent: "brief",
  mode: "freestyle",
  at: T0,
};

const arrived: ChatAction = {
  type: "proposalsArrived",
  runId: "run-1",
  proposals: [
    { templateName: SQUARE.proposal.templateName, canvas: SQUARE.canvas },
    { templateName: LINK.proposal.templateName, canvas: LINK.canvas },
  ],
  meta: { model: "claude-x", candidateCount: 2, mode: "freestyle" },
  warnings: [],
};

const assistantOf = (thread: ChatThread): AssistantTurn => {
  const turn = thread.turns.find((t) => t.role === "assistant");
  if (!turn || turn.role !== "assistant") throw new Error("no assistant turn");
  return turn;
};

const handlers = () => ({
  onPickDraft: vi.fn(),
  registerPreview: vi.fn(),
  onEditDraft: vi.fn(),
  onDownloadDraft: vi.fn(),
  onDownloadAll: vi.fn(),
  onTryNext: vi.fn(),
  onRetry: vi.fn(),
  onFillIn: vi.fn(),
});

const renderTurn = (
  turn: AssistantTurn,
  h: ReturnType<typeof handlers>,
  over: Partial<{ pickedDraftId: string; selectedDraftId: string | null }> = {},
) =>
  render(
    <GenerateTurn
      turn={turn}
      photo={null}
      tryNext={[]}
      canRetry={false}
      selectedDraftId={over.selectedDraftId ?? null}
      busyDraftId={null}
      pickedDraftId={over.pickedDraftId}
      {...h}
    />,
  );

describe("GenerateTurn", () => {
  it("shows Progress and the Result card's Loading state while the drafts build", () => {
    const turn = assistantOf(run(sent, arrived));
    const { container } = renderTurn(turn, handlers());
    expect(screen.getByRole("progressbar")).toBeTruthy();
    const card = container.querySelector(".ui-result-card");
    expect(card?.getAttribute("data-state")).toBe("loading");
    expect(screen.queryByRole("button", { name: /Download/ })).toBeNull();
  });

  it("puts every draft on one card, switching between them", async () => {
    const turn = assistantOf(
      run(
        sent,
        arrived,
        { type: "draftResolved", runId: "run-1", draft: SQUARE },
        { type: "draftResolved", runId: "run-1", draft: LINK },
        { type: "done", runId: "run-1", reply: "Here it is in two sizes.", at: T0 },
      ),
    );
    const h = handlers();
    const { rerender } = renderTurn(turn, h);
    const group = screen.getByRole("radiogroup", { name: "Variations" });
    const tabs = Array.from(group.querySelectorAll("[role=radio]")).map((el) => el.textContent);
    expect(tabs).toEqual(["Instagram", "LinkedIn"]);
    expect(screen.getByText("1080 × 1080")).toBeTruthy();
    expect(screen.getByTestId("art").textContent).toBe("Feature highlight");

    await userEvent.click(screen.getByRole("radio", { name: "LinkedIn" }));
    expect(h.onPickDraft).toHaveBeenCalledWith(turn.id, "d2");

    // The page's pick shows the second draft, its size and its caption.
    rerender(
      <GenerateTurn
        turn={turn}
        photo={null}
        tryNext={[]}
        canRetry={false}
        selectedDraftId={null}
        busyDraftId={null}
        pickedDraftId="d2"
        {...h}
      />,
    );
    expect(screen.getByText("1200 × 627")).toBeTruthy();
    expect(screen.getByTestId("art").textContent).toBe("Open role");

    await userEvent.click(screen.getByRole("button", { name: "Edit Open role" }));
    expect(h.onEditDraft).toHaveBeenCalledWith(turn.id, "d2");
    await userEvent.click(screen.getByRole("button", { name: "Download Open role" }));
    expect(h.onDownloadDraft).toHaveBeenCalledWith(turn.id, "d2");
    await userEvent.click(screen.getByRole("button", { name: "Download both" }));
    expect(h.onDownloadAll).toHaveBeenCalledWith(turn.id);
    // One Edit stands for every draft, so focus can return to it.
    expect(h.registerPreview).toHaveBeenCalledWith("d1", expect.any(HTMLButtonElement));
    expect(h.registerPreview).toHaveBeenCalledWith("d2", expect.any(HTMLButtonElement));
  });

  it("follows the editor's draft while it is open on the turn", () => {
    const turn = assistantOf(
      run(
        sent,
        arrived,
        { type: "draftResolved", runId: "run-1", draft: SQUARE },
        { type: "draftResolved", runId: "run-1", draft: LINK },
        { type: "done", runId: "run-1", reply: "Here it is in two sizes.", at: T0 },
      ),
    );
    renderTurn(turn, handlers(), { pickedDraftId: "d1", selectedDraftId: "d2" });
    expect(screen.getByTestId("art").textContent).toBe("Open role");
    expect(
      screen.getByRole("button", { name: "Edit Open role" }).getAttribute("aria-current"),
    ).toBe("true");
  });

  it("names the card's Download by how many drafts it holds", () => {
    expect([1, 2, 3].map(downloadAllLabel)).toEqual(["Download", "Download both", "Download all"]);
  });
});
