import { describe, expect, it, vi } from "vitest";
import type {
  FieldValues,
  GeneratedDesign,
  GeneratedProposal,
  GenerateThreadInput,
  GenerateThreadRecord,
  StoredAssistantTurn,
  StoredUserTurn,
  TemplateField,
  TemplateSchema,
} from "../types";
import type { AssistantTurn, ChatDraft, ChatPhoto, ChatThread, ChatTurn, UserTurn } from "./chat";
import {
  MAX_TURNS,
  chatReducer,
  emptyThread,
  settleOrphanedRuns,
  type ChatAction,
} from "./chatReducer";
import { designToSchema } from "./designToSchema";
import { fallbackTitle } from "./draftView";
import { DONE_FALLBACK, NOTHING_FIT, STOPPED_STATUS } from "./runCopy";
import { assertNoDataUrls, fromStoredThread, isDataUrl, toStoredThread } from "./threadStorage";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const T0 = "2026-09-25T10:00:00.000Z";
const T1 = "2026-09-25T10:00:05.000Z";
const T2 = "2026-09-25T10:04:00.000Z";
const T3 = "2026-09-25T10:09:00.000Z";

const BRIEF =
  "We're hiring a Creative Director for the Chicago studio, starting October 6, apply by the 30th.";

/** The member's photo, as the composer holds it. */
const PHOTO_URL = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD";
const PHOTO: ChatPhoto = { dataUrl: PHOTO_URL, aspect: 1.5, source: "upload" };
/** An image the member uploaded into a field in the editor. */
const UPLOAD = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB";

const field = (over: Partial<TemplateField>): TemplateField => ({
  id: over.fieldKey ?? "f",
  label: "Headline",
  fieldKey: "headline",
  type: "text",
  x: 0,
  y: 0,
  width: 400,
  height: 100,
  ...over,
});

const FIELDS: TemplateField[] = [
  field({ fieldKey: "headline", label: "Headline", required: true }),
  field({ fieldKey: "location", label: "Location" }),
  field({ fieldKey: "headshot", label: "Headshot", type: "image" }),
  field({ fieldKey: "legal", label: "Legal", static: true, staticValue: "© Studio" }),
];

const template = (
  id: string,
  name: string,
  width: number,
  height: number,
  status: TemplateSchema["status"] = "published",
): TemplateSchema => ({
  id,
  companyId: "co-1",
  name,
  description: "",
  category: "",
  tags: [],
  status,
  canvasWidth: width,
  canvasHeight: height,
  backgroundUrl: "",
  fields: FIELDS,
  captionTemplate: "{headline}",
  createdAt: T0,
  updatedAt: T0,
});

const INSTAGRAM = template("tpl-ig", "Now hiring", 1080, 1350);
const LINKEDIN = template("tpl-li", "Open role", 1200, 627);
const FACEBOOK = template("tpl-fb", "Link card", 1200, 630);

const DESIGN: GeneratedDesign = {
  name: "Warm hiring card",
  canvasWidth: 1080,
  canvasHeight: 1350,
  backgroundColor: "#f4f1ea",
  captionTemplate: "Join us: {headline}",
  fields: [
    field({ id: "d1", fieldKey: "headline" }),
    field({ id: "d2", fieldKey: "mark", type: "image", static: true, staticValue: "logo.png" }),
  ],
};

const VALUES: FieldValues = { headline: "Now hiring", location: "Chicago" };

const proposal = (
  t: { id: string; name: string },
  over: Partial<GeneratedProposal> = {},
): GeneratedProposal => ({
  templateId: t.id,
  templateName: t.name,
  values: { ...VALUES },
  caption: "Come paint with us.",
  why: "It fits.",
  imageFieldsNeeded: [{ fieldKey: "headshot", label: "Headshot", required: false }],
  ...over,
});

const libraryDraft = (
  id: string,
  t: TemplateSchema,
  values: FieldValues = { ...VALUES },
): ChatDraft => ({
  id,
  proposal: proposal(t),
  schema: t,
  canvas: { width: t.canvasWidth, height: t.canvasHeight },
  values,
});

/** A draft whose template had gone by the time the chat was reopened. */
const goneDraft = (id: string, width: number, height: number): ChatDraft => ({
  id,
  proposal: proposal({ id: `tpl-gone-${id}`, name: "Old card" }),
  schema: null,
  canvas: { width, height },
  values: { ...VALUES },
});

const freestyleDraft = (id: string, design: GeneratedDesign = DESIGN): ChatDraft => ({
  id,
  proposal: proposal({ id: "freestyle", name: design.name }, { design, caption: "Join us." }),
  schema: designToSchema(design, "co-1", 1, { model: "claude-x", generatedAt: T1 }),
  canvas: { width: design.canvasWidth, height: design.canvasHeight },
  values: { headline: "Now hiring" },
});

const user = (id: string, text = BRIEF, over: Partial<UserTurn> = {}): UserTurn => ({
  id,
  role: "user",
  text,
  createdAt: T0,
  variations: 2,
  intent: "brief",
  ...over,
});

const STATUS: Record<AssistantTurn["phase"], string> = {
  asking: "Reading your brief and choosing from your templates.",
  measuring: "Filling in your Now hiring and Open role templates.",
  done: DONE_FALLBACK,
  stopped: STOPPED_STATUS,
  error: NOTHING_FIT,
};

const answer = (
  id: string,
  replyTo: string,
  phase: AssistantTurn["phase"],
  drafts: ChatDraft[] = [],
  over: Partial<AssistantTurn> = {},
): AssistantTurn => ({
  id,
  role: "assistant",
  createdAt: T1,
  replyTo,
  phase,
  step: 3,
  stepLabel: "Checking every line fits",
  status: STATUS[phase],
  expected: 2,
  drafts,
  pendingSlots: phase === "measuring" ? 1 : 0,
  warnings: [],
  meta: { model: "claude-x", candidateCount: 8, mode: "library" },
  ...(phase === "error" ? { error: STATUS.error } : {}),
  ...over,
});

const threadOf = (turns: ChatTurn[], title = "Creative Director post"): ChatThread => ({
  id: "thread-1",
  title,
  turns,
  createdAt: T0,
  updatedAt: T2,
});

/** One message and its finished answer: a library draft at LinkedIn size. */
const exchange = (n: number): ChatTurn[] => [
  user(`u${n}`, `Message ${n}`, { intent: n === 1 ? "brief" : "followUp" }),
  answer(`a${n}`, `u${n}`, "done", [libraryDraft(`d${n}`, LINKEDIN)]),
];

/** As the database hands a row back: JSON, with undefined gone. */
const json = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const recordOf = (thread: ChatThread, id = "thread-1"): GenerateThreadRecord =>
  json({ id, createdAt: T0, updatedAt: T3, ...toStoredThread(thread) });

const loadersFor = (templates: TemplateSchema[], companyId = "co-1") => ({
  getTemplate: vi.fn(async (id: string) => templates.find((t) => t.id === id) ?? null),
  companyId,
});

const storedUser = (input: GenerateThreadInput, i: number): StoredUserTurn => {
  const turn = input.turns[i];
  if (turn.role !== "user") throw new Error(`turn ${i} is not a message`);
  return turn;
};

const storedAnswer = (input: GenerateThreadInput, i: number): StoredAssistantTurn => {
  const turn = input.turns[i];
  if (turn.role !== "assistant") throw new Error(`turn ${i} is not an answer`);
  return turn;
};

const restoredAnswer = (thread: ChatThread, id: string): AssistantTurn => {
  const turn = thread.turns.find((t) => t.id === id);
  if (!turn || turn.role !== "assistant") throw new Error(`no answer ${id}`);
  return turn;
};

// ---------------------------------------------------------------------------
// isDataUrl
// ---------------------------------------------------------------------------

describe("isDataUrl", () => {
  it("reads a string that starts with data: as one, in any case and after leading space", () => {
    for (const value of [
      PHOTO_URL,
      UPLOAD,
      "DATA:IMAGE/PNG;BASE64,AAAA",
      "  data:image/png;base64,AAAA",
      "\ndata:image/svg+xml,%3Csvg%3E",
      "data:,hello",
      "data:x",
      "data:",
    ]) {
      expect(isDataUrl(value), value).toBe(true);
    }
  });

  it("reads every form a browser still loads as an image, sentences included", () => {
    for (const value of [
      "data: image/png;base64,AAAA",
      "data:\nimage/png;base64,AAAA",
      "da\nta:image/jpeg;base64,AAAA",
      "d\ta\rt\na:image/png;base64,AAAA",
      "\u0000data:image/png;base64,AAAA",
      "data:Q3;base64,AAAA",
      "data: Q3 revenue is up 20%",
      "Data:  twelve new hires",
    ]) {
      expect(isDataUrl(value), JSON.stringify(value)).toBe(true);
    }
  });

  it("leaves anything that does not start with data: alone", () => {
    for (const value of [
      "See data:image/png;base64,AAAA",
      "metadata:x",
      "https://cdn.example.com/a.png",
      "",
    ]) {
      expect(isDataUrl(value), value).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// toStoredThread
// ---------------------------------------------------------------------------

describe("toStoredThread: the photo and every data URL", () => {
  it("saves a message without its photo, keeping the photo's aspect", () => {
    // Through the reducer, as the page builds it.
    const actions: ChatAction[] = [
      {
        type: "sent",
        runId: "a1",
        userTurnId: "u1",
        text: BRIEF,
        photo: PHOTO,
        platformHint: "instagram",
        variations: 2,
        intent: "brief",
        mode: "library",
        at: T0,
      },
      {
        type: "proposalsArrived",
        runId: "a1",
        proposals: [{ templateName: "Now hiring", canvas: { width: 1080, height: 1350 } }],
        meta: { model: "claude-x", candidateCount: 8, mode: "library" },
        warnings: [],
      },
      { type: "draftResolved", runId: "a1", draft: libraryDraft("d1", INSTAGRAM) },
      { type: "done", runId: "a1", at: T1 },
    ];
    const thread = actions.reduce(chatReducer, emptyThread(T0));
    const stored = toStoredThread(thread);

    expect(storedUser(stored, 0)).toEqual({
      id: "u1",
      role: "user",
      text: BRIEF,
      createdAt: T0,
      hadPhoto: { aspect: 1.5 },
      platformHint: "instagram",
      variations: 2,
      intent: "brief",
    });
    expect(JSON.stringify(stored)).not.toContain("base64");
  });

  it("keeps the aspect of a photo whose message never recorded it", () => {
    const stored = toStoredThread(
      threadOf([user("u1", BRIEF, { photo: PHOTO }), answer("a1", "u1", "done", [])]),
    );
    expect(storedUser(stored, 0)).not.toHaveProperty("photo");
    expect(storedUser(stored, 0).hadPhoto).toEqual({ aspect: 1.5 });
  });

  it("deletes every data: value at any depth, key and all", () => {
    const edited = libraryDraft("d1", INSTAGRAM, { ...VALUES, headshot: UPLOAD });
    edited.proposal = proposal(INSTAGRAM, {
      values: { ...VALUES, headshot: PHOTO_URL },
      imageTargetFieldKey: "headshot",
    });
    const design: GeneratedDesign = {
      ...DESIGN,
      fields: [
        ...DESIGN.fields,
        field({ id: "d3", fieldKey: "badge", type: "image", static: true, staticValue: UPLOAD }),
      ],
    };
    const stored = toStoredThread(
      threadOf([
        user("u1", BRIEF, { photo: PHOTO, hadPhoto: { aspect: 1.5 } }),
        answer("a1", "u1", "done", [edited, freestyleDraft("d2", design)], {
          warnings: ["Headshot: kept your photo.", UPLOAD],
          reply: PHOTO_URL,
        }),
      ]),
    );

    const a1 = storedAnswer(stored, 1);
    const [library, freestyle] = a1.drafts;
    expect(library.values).toEqual(VALUES);
    expect(library.values).not.toHaveProperty("headshot");
    expect(library.proposal.values).toEqual(VALUES);
    expect(library.proposal.imageTargetFieldKey).toBe("headshot");
    // The design keeps the element; only its data URL goes.
    const badge = freestyle.proposal.design?.fields.find((f) => f.fieldKey === "badge");
    expect(badge).toBeDefined();
    expect(badge).not.toHaveProperty("staticValue");
    expect(freestyle.proposal.design?.fields.find((f) => f.fieldKey === "mark")?.staticValue).toBe(
      "logo.png",
    );
    expect(a1.warnings).toEqual(["Headshot: kept your photo."]);
    expect(a1).not.toHaveProperty("reply");
    expect(stored.preview?.values).toEqual(VALUES);
    expect(JSON.stringify(stored)).not.toMatch(/data:/i);
  });

  it("deletes data URLs in any case and after leading space", () => {
    const draft = libraryDraft("d1", INSTAGRAM, {
      ...VALUES,
      headshot: "DATA:IMAGE/PNG;BASE64,AAAA",
      badge: "  data:image/png;base64,AAAA",
    });
    const stored = toStoredThread(threadOf([user("u1"), answer("a1", "u1", "done", [draft])]));
    expect(storedAnswer(stored, 1).drafts[0].values).toEqual(VALUES);
  });

  it("deletes a value, and blanks a message, with whitespace after the colon", () => {
    // Browsers load "data: image/png;base64,…" as an image, so a space
    // after the colon makes nothing safe, and a sentence that begins with
    // "data:" goes the same way.
    const draft = libraryDraft("d1", INSTAGRAM, {
      ...VALUES,
      headshot: "data: image/png;base64,AAAA",
      badge: "da\nta:image/png;base64,AAAA",
    });
    const stored = toStoredThread(
      threadOf([user("u1", "data: Q3 revenue is up 20%"), answer("a1", "u1", "done", [draft])]),
    );
    expect(storedUser(stored, 0).text).toBe("");
    expect(storedAnswer(stored, 1).drafts[0].values).toEqual(VALUES);
    expect(() => assertNoDataUrls(stored)).not.toThrow();
  });

  it("blanks a required string that is a data URL, so the saved shape stays whole", () => {
    const draft = libraryDraft("d1", INSTAGRAM);
    draft.proposal = proposal(INSTAGRAM, { caption: UPLOAD, why: UPLOAD });
    const stored = toStoredThread(
      threadOf(
        [
          user("u1", PHOTO_URL),
          answer("a1", "u1", "error", [draft], { status: UPLOAD, error: UPLOAD }),
        ],
        PHOTO_URL,
      ),
    );
    const a1 = storedAnswer(stored, 1);
    expect(storedUser(stored, 0).text).toBe("");
    expect(a1.status).toBe("");
    expect(a1).not.toHaveProperty("error");
    expect(a1.drafts[0].proposal.caption).toBe("");
    expect(a1.drafts[0].proposal.why).toBe("");
    expect(stored.title).toBe("");
    expect(() => assertNoDataUrls(stored)).not.toThrow();
  });

  it("never touches the thread, and shares nothing with it", () => {
    const draft = libraryDraft("d1", INSTAGRAM, { ...VALUES, headshot: UPLOAD });
    const thread = threadOf([
      user("u1", BRIEF, { photo: PHOTO }),
      answer("a1", "u1", "done", [draft]),
    ]);
    const before = structuredClone(thread);
    const stored = toStoredThread(thread);
    expect(thread).toEqual(before);
    const saved = storedAnswer(stored, 1).drafts[0];
    expect(saved.values).not.toBe(draft.values);
    expect(saved.proposal).not.toBe(draft.proposal);
    expect(stored.preview?.values).not.toBe(saved.values);
  });

  it("leaves out every run-only and UI field, and each draft's schema", () => {
    const stored = toStoredThread(
      threadOf([
        user("u1"),
        answer("a1", "u1", "done", [libraryDraft("d1", INSTAGRAM)], {
          slotCanvases: [{ width: 1080, height: 1350 }],
          reply: "Here you go, in both sizes.",
        }),
      ]),
    );
    expect(storedAnswer(stored, 1)).toEqual({
      id: "a1",
      role: "assistant",
      createdAt: T1,
      replyTo: "u1",
      phase: "done",
      status: DONE_FALLBACK,
      reply: "Here you go, in both sizes.",
      warnings: [],
      meta: { model: "claude-x", candidateCount: 8, mode: "library" },
      drafts: [
        {
          id: "d1",
          proposal: proposal(INSTAGRAM),
          canvas: { width: 1080, height: 1350 },
          values: VALUES,
        },
      ],
    });
  });
});

describe("toStoredThread: which turns are kept", () => {
  it("leaves a run in flight out, with the message it answers", () => {
    const thread = threadOf([
      ...exchange(1),
      user("u2", "Make it warmer", { intent: "followUp" }),
      answer("a2", "u2", "measuring", [libraryDraft("d2", INSTAGRAM)]),
    ]);
    const stored = toStoredThread(thread);
    expect(stored.turns.map((t) => t.id)).toEqual(["u1", "a1"]);
    // The unfinished turn's Instagram draft is not counted either.
    expect(stored.platforms).toEqual(["linkedin"]);
  });

  it("saves nothing of a first run still asking", () => {
    const stored = toStoredThread(threadOf([user("u1"), answer("a1", "u1", "asking")], "New chat"));
    expect(stored.turns).toEqual([]);
    expect(stored.preview).toBeNull();
    expect(stored.platforms).toEqual([]);
    // The title is the brief's all the same.
    expect(stored.title).toBe(fallbackTitle(BRIEF));
  });

  it("keeps a stopped or failed answer with its message", () => {
    const stored = toStoredThread(
      threadOf([
        user("u1"),
        answer("a1", "u1", "error"),
        user("u2", "Try it shorter", { intent: "followUp" }),
        answer("a2", "u2", "stopped", [libraryDraft("d2", INSTAGRAM)]),
      ]),
    );
    expect(stored.turns.map((t) => t.id)).toEqual(["u1", "a1", "u2", "a2"]);
    expect(storedAnswer(stored, 1)).toMatchObject({
      phase: "error",
      status: NOTHING_FIT,
      error: NOTHING_FIT,
      drafts: [],
    });
    expect(storedAnswer(stored, 3)).toMatchObject({ phase: "stopped", status: STOPPED_STATUS });
    expect(storedAnswer(stored, 3).drafts.map((d) => d.id)).toEqual(["d2"]);
  });

  it("never saves a message without its answer, or an answer without its message", () => {
    const stored = toStoredThread(
      threadOf([
        user("u0", "Unanswered"),
        ...exchange(1),
        answer("a-lost", "u-missing", "done", [libraryDraft("d9", INSTAGRAM)]),
      ]),
    );
    expect(stored.turns.map((t) => t.id)).toEqual(["u1", "a1"]);
  });

  it("cuts a chat at 40 turns, keeping the first exchanges", () => {
    const turns = Array.from({ length: 22 }, (_, i) => exchange(i + 1)).flat();
    const stored = toStoredThread(threadOf(turns));
    expect(stored.turns).toHaveLength(MAX_TURNS);
    expect(stored.turns[MAX_TURNS - 1].id).toBe("a20");
  });

  it("never splits an exchange at the cut", () => {
    // A message answered twice puts the cut between u20 and its answer.
    const turns = [
      user("u1"),
      answer("a1", "u1", "error"),
      answer("a1b", "u1", "done", [libraryDraft("d1", LINKEDIN)]),
      ...Array.from({ length: 19 }, (_, i) => exchange(i + 2)).flat(),
    ];
    const stored = toStoredThread(threadOf(turns));
    expect(stored.turns).toHaveLength(MAX_TURNS - 1);
    expect(stored.turns[stored.turns.length - 1].id).toBe("a19");
    const answered = new Set(
      stored.turns.flatMap((t) => (t.role === "assistant" ? [t.replyTo] : [])),
    );
    for (const t of stored.turns) if (t.role === "user") expect(answered.has(t.id)).toBe(true);
  });
});

describe("toStoredThread: platforms, preview and title", () => {
  it("lists the drafts' distinct primary platforms in PLATFORMS order", () => {
    const stored = toStoredThread(
      threadOf([
        user("u1"),
        answer("a1", "u1", "done", [libraryDraft("d1", INSTAGRAM), libraryDraft("d2", LINKEDIN)]),
        user("u2", "More sizes", { intent: "followUp" }),
        answer("a2", "u2", "stopped", [
          libraryDraft("d3", FACEBOOK),
          // A gone template still has its canvas: Pinterest.
          goneDraft("d4", 1000, 1500),
          // A custom size is General; 1080 × 1080 is Instagram again.
          goneDraft("d5", 777, 333),
          goneDraft("d6", 1080, 1080),
        ]),
      ]),
    );
    expect(stored.platforms).toEqual(["linkedin", "instagram", "facebook", "pinterest", "general"]);
  });

  it("previews the first draft of the first done turn, with its current values", () => {
    const edited = libraryDraft("d3", LINKEDIN, { headline: "Edited", headshot: UPLOAD });
    const stored = toStoredThread(
      threadOf([
        user("u1"),
        // Stopped: its drafts are no preview.
        answer("a1", "u1", "stopped", [libraryDraft("d1", INSTAGRAM)]),
        user("u2", "Again", { intent: "followUp" }),
        answer("a2", "u2", "done", [edited, libraryDraft("d4", INSTAGRAM)]),
        ...exchange(3),
      ]),
    );
    expect(stored.preview).toEqual({
      templateId: "tpl-li",
      values: { headline: "Edited" },
      canvas: { width: 1200, height: 627 },
    });
  });

  it("previews a freestyle draft by its design", () => {
    const stored = toStoredThread(
      threadOf([user("u1"), answer("a1", "u1", "done", [freestyleDraft("d1")])]),
    );
    expect(stored.preview).toEqual({
      design: json(DESIGN),
      values: { headline: "Now hiring" },
      canvas: { width: 1080, height: 1350 },
    });
    expect(stored.preview).not.toHaveProperty("templateId");
  });

  it("has no preview until a turn is done", () => {
    const stored = toStoredThread(
      threadOf([user("u1"), answer("a1", "u1", "stopped", [libraryDraft("d1", INSTAGRAM)])]),
    );
    expect(stored.preview).toBeNull();
  });

  it("keeps the chat's title, else titles it from the first brief", () => {
    const turns = exchange(1);
    const brief = "Message 1";
    expect(toStoredThread(threadOf(turns, "Creative Director post")).title).toBe(
      "Creative Director post",
    );
    expect(toStoredThread(threadOf(turns, "New chat")).title).toBe(fallbackTitle(brief));
    expect(toStoredThread(threadOf(turns, "   ")).title).toBe(fallbackTitle(brief));
    expect(toStoredThread(threadOf([], "New chat")).title).toBe("");
  });

  it("keeps a title within the column's 120 characters, counted as Postgres does", () => {
    const stored = toStoredThread(threadOf(exchange(1), "\u{1F3A8}".repeat(130)));
    expect(Array.from(stored.title)).toHaveLength(120);
  });
});

// ---------------------------------------------------------------------------
// assertNoDataUrls
// ---------------------------------------------------------------------------

describe("assertNoDataUrls", () => {
  const clean = (): GenerateThreadInput =>
    json(
      toStoredThread(
        threadOf([
          user("u1"),
          answer("a1", "u1", "done", [libraryDraft("d1", INSTAGRAM), freestyleDraft("d2")]),
        ]),
      ),
    );

  it("passes whatever toStoredThread saves, however many data URLs the thread held", () => {
    const edited = libraryDraft("d1", INSTAGRAM, { ...VALUES, headshot: UPLOAD, [UPLOAD]: "x" });
    edited.proposal = proposal(INSTAGRAM, {
      values: { headshot: PHOTO_URL },
      caption: PHOTO_URL,
      imageTargetFieldKey: PHOTO_URL,
    });
    const stored = toStoredThread(
      threadOf(
        [
          user("u1", PHOTO_URL, { photo: PHOTO, templateIdHint: PHOTO_URL }),
          answer("a1", "u1", "done", [edited], {
            status: PHOTO_URL,
            reply: PHOTO_URL,
            warnings: [PHOTO_URL],
            meta: { model: PHOTO_URL, candidateCount: 1, mode: "library" },
          }),
        ],
        PHOTO_URL,
      ),
    );
    expect(() => assertNoDataUrls(stored)).not.toThrow();
    expect(JSON.stringify(stored)).not.toContain("base64");
  });

  it("passes a clean chat", () => {
    expect(() => assertNoDataUrls(clean())).not.toThrow();
  });

  it("throws at a data URL anywhere, naming where it sits and not what it holds", () => {
    const cases: Array<[(input: GenerateThreadInput) => void, RegExp]> = [
      [
        (input) => {
          storedAnswer(input, 1).drafts[0].values.headshot = UPLOAD;
        },
        /thread\.turns\[1\]\.drafts\[0\]\.values\.headshot/,
      ],
      [
        (input) => {
          storedAnswer(input, 1).drafts[1].proposal.design!.fields[1].staticValue = UPLOAD;
        },
        /thread\.turns\[1\]\.drafts\[1\]\.proposal\.design\.fields\[1\]\.staticValue/,
      ],
      [
        (input) => {
          input.preview!.values.headshot = "DATA:IMAGE/PNG;BASE64,AAAA";
        },
        /thread\.preview\.values\.headshot/,
      ],
      [
        (input) => {
          storedAnswer(input, 1).warnings.push(PHOTO_URL);
        },
        /thread\.turns\[1\]\.warnings\[0\]/,
      ],
      [
        (input) => {
          storedUser(input, 0).text = PHOTO_URL;
        },
        /thread\.turns\[0\]\.text/,
      ],
      [
        (input) => {
          storedAnswer(input, 1).drafts[0].values[UPLOAD] = "x";
        },
        /thread\.turns\[1\]\.drafts\[0\]\.values \(a key\)/,
      ],
    ];
    for (const [corrupt, where] of cases) {
      const input = clean();
      corrupt(input);
      expect(() => assertNoDataUrls(input)).toThrow(where);
      expect(() => assertNoDataUrls(input)).not.toThrow(/base64/i);
    }
  });

  it("refuses the forms a browser still loads: a space after the colon, a line break inside", () => {
    for (const text of ["data: image/png;base64,AAAA", "da\nta:image/png;base64,AAAA"]) {
      const input = clean();
      storedUser(input, 0).text = text;
      expect(() => assertNoDataUrls(input)).toThrow(/thread\.turns\[0\]\.text/);
    }
  });
});

// ---------------------------------------------------------------------------
// fromStoredThread
// ---------------------------------------------------------------------------

describe("fromStoredThread", () => {
  /** A chat of two finished exchanges: Instagram and LinkedIn drafts, then
   * both again after an edit, plus a freestyle design. */
  const saved = () =>
    threadOf([
      user("u1", BRIEF, { photo: PHOTO, hadPhoto: { aspect: 1.5 }, platformHint: "instagram" }),
      answer("a1", "u1", "done", [libraryDraft("d1", INSTAGRAM), libraryDraft("d2", LINKEDIN)], {
        reply: "Here you go, in both sizes.",
      }),
      user("u2", "Make the date Friday", { intent: "followUp", createdAt: T2 }),
      answer(
        "a2",
        "u2",
        "done",
        [libraryDraft("d3", INSTAGRAM, { ...VALUES, headline: "Friday" }), freestyleDraft("d4")],
        { createdAt: T2, meta: { model: "claude-y", candidateCount: 8, mode: "freestyle" } },
      ),
    ]);

  it("restores the chat with every id it was saved with", async () => {
    const restored = await fromStoredThread(
      recordOf(saved(), "thread-9"),
      loadersFor([INSTAGRAM, LINKEDIN]),
    );
    expect(restored.id).toBe("thread-9");
    expect(restored.title).toBe("Creative Director post");
    expect(restored.createdAt).toBe(T0);
    expect(restored.updatedAt).toBe(T3);
    expect(restored.turns.map((t) => t.id)).toEqual(["u1", "a1", "u2", "a2"]);
    expect(restoredAnswer(restored, "a1").replyTo).toBe("u1");
    expect(restoredAnswer(restored, "a2").drafts.map((d) => d.id)).toEqual(["d3", "d4"]);
  });

  it("refetches each library template once, however many drafts fill it", async () => {
    const loaders = loadersFor([INSTAGRAM, LINKEDIN]);
    const restored = await fromStoredThread(recordOf(saved()), loaders);
    expect(loaders.getTemplate).toHaveBeenCalledTimes(2);
    expect(loaders.getTemplate.mock.calls.map(([id]) => id).sort()).toEqual(["tpl-ig", "tpl-li"]);

    const [d1, d2] = restoredAnswer(restored, "a1").drafts;
    expect(d1).toEqual({
      id: "d1",
      proposal: proposal(INSTAGRAM),
      schema: INSTAGRAM,
      canvas: { width: 1080, height: 1350 },
      values: VALUES,
    });
    expect(d2.schema).toBe(LINKEDIN);
    expect(restoredAnswer(restored, "a2").drafts[0].values.headline).toBe("Friday");
  });

  it("leaves a draft whose template is gone or unpublished without a schema, its canvas kept", async () => {
    const unpublished = template("tpl-li", "Open role", 1080, 1080, "draft");
    const restored = await fromStoredThread(recordOf(saved()), loadersFor([unpublished]));
    const [d1, d2] = restoredAnswer(restored, "a1").drafts;
    expect(d1.schema).toBeNull();
    expect(d1.canvas).toEqual({ width: 1080, height: 1350 });
    expect(d2.schema).toBeNull();
    // Its saved shape, not the unpublished template's.
    expect(d2.canvas).toEqual({ width: 1200, height: 627 });
    expect(d2.values).toEqual(VALUES);
  });

  it("takes the shape of a template resized since the chat was saved", async () => {
    const resized = template("tpl-ig", "Now hiring", 1080, 1080);
    const restored = await fromStoredThread(recordOf(saved()), loadersFor([resized, LINKEDIN]));
    expect(restoredAnswer(restored, "a1").drafts[0].canvas).toEqual({ width: 1080, height: 1080 });
  });

  it("rebuilds a freestyle draft from its design, stamped with its turn's model and start", async () => {
    const loaders = loadersFor([INSTAGRAM, LINKEDIN], "co-9");
    const restored = await fromStoredThread(recordOf(saved()), loaders);
    const d4 = restoredAnswer(restored, "a2").drafts[1];
    expect(d4.schema).toEqual({
      // Its place in its turn is second.
      ...designToSchema(json(DESIGN), "co-9", 2, { model: "claude-y", generatedAt: T2 }),
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
    });
    expect(d4.canvas).toEqual({ width: 1080, height: 1350 });
    expect(d4.values).toEqual({ headline: "Now hiring" });
    expect(loaders.getTemplate).not.toHaveBeenCalledWith("freestyle");
  });

  it("restores stopped and failed turns as they finished", async () => {
    const thread = threadOf([
      user("u1"),
      answer("a1", "u1", "error", [], { warnings: ["Open role: dropped, too long."] }),
      user("u2", "Try it shorter", { intent: "followUp" }),
      answer("a2", "u2", "stopped", [libraryDraft("d2", INSTAGRAM)]),
    ]);
    const restored = await fromStoredThread(recordOf(thread), loadersFor([INSTAGRAM]));
    expect(restoredAnswer(restored, "a1")).toEqual({
      id: "a1",
      role: "assistant",
      createdAt: T1,
      replyTo: "u1",
      phase: "error",
      step: 3,
      stepLabel: "",
      status: NOTHING_FIT,
      expected: 2,
      drafts: [],
      pendingSlots: 0,
      warnings: ["Open role: dropped, too long."],
      error: NOTHING_FIT,
      meta: { model: "claude-x", candidateCount: 8, mode: "library" },
    });
    const a2 = restoredAnswer(restored, "a2");
    expect(a2.phase).toBe("stopped");
    expect(a2.status).toBe(STOPPED_STATUS);
    expect(a2.drafts.map((d) => d.schema)).toEqual([INSTAGRAM]);
  });

  it("never restores a photo; a message that had one says so", async () => {
    const restored = await fromStoredThread(recordOf(saved()), loadersFor([INSTAGRAM, LINKEDIN]));
    const u1 = restored.turns[0] as UserTurn;
    expect(u1).toEqual({
      id: "u1",
      role: "user",
      text: BRIEF,
      createdAt: T0,
      hadPhoto: { aspect: 1.5 },
      platformHint: "instagram",
      variations: 2,
      intent: "brief",
    });
    expect(u1).not.toHaveProperty("photo");
  });

  it("titles a chat saved without one from its first brief", async () => {
    const record = { ...recordOf(saved()), title: "" };
    const restored = await fromStoredThread(record, loadersFor([INSTAGRAM, LINKEDIN]));
    expect(restored.title).toBe(fallbackTitle(BRIEF));
  });

  it("hands the reducer a thread it takes as it is", async () => {
    const thread = threadOf([
      ...saved().turns,
      user("u3", "One more", { intent: "followUp" }),
      answer("a3", "u3", "done", [goneDraft("d5", 1200, 627), libraryDraft("d6", LINKEDIN)]),
    ]);
    const restored = await fromStoredThread(recordOf(thread), loadersFor([INSTAGRAM, LINKEDIN]));

    // Nothing is running, so nothing needs settling.
    expect(settleOrphanedRuns(restored)).toBe(restored);
    // A late action from any of its runs changes nothing.
    const late: ChatAction[] = [
      { type: "draftResolved", runId: "a3", draft: libraryDraft("dx", INSTAGRAM) },
      { type: "draftDropped", runId: "a2", warning: "late" },
      { type: "checking", runId: "a1" },
      { type: "done", runId: "a3", at: T3 },
      { type: "stopped", runId: "a3", at: T3 },
      { type: "failed", runId: "a1", message: "late", at: T3 },
      { type: "titleSet", title: "Another name", at: T3 },
      { type: "idAssigned", id: "thread-1" },
      // A draft whose template has gone cannot be edited.
      {
        type: "valuesEdited",
        turnId: "a3",
        edits: [{ draftId: "d5", fieldKey: "headline", value: "x" }],
        at: T3,
      },
    ];
    for (const action of late) expect(chatReducer(restored, action), action.type).toBe(restored);

    // A draft on a template that is still there can.
    const edited = chatReducer(restored, {
      type: "valuesEdited",
      turnId: "a3",
      edits: [{ draftId: "d6", fieldKey: "headline", value: "Edited" }],
      at: T3,
    });
    expect(restoredAnswer(edited, "a3").drafts[1].values.headline).toBe("Edited");

    // And the next message goes out as in any chat.
    const next = chatReducer(restored, {
      type: "sent",
      runId: "a4",
      userTurnId: "u4",
      text: "Make it warmer",
      variations: 1,
      intent: "followUp",
      mode: "library",
      at: T3,
    });
    expect(next.turns.map((t) => t.id).slice(-2)).toEqual(["u4", "a4"]);
    expect(restoredAnswer(next, "a4").phase).toBe("asking");
  });

  it("saves again exactly as it was saved", async () => {
    const record = recordOf(saved());
    const restored = await fromStoredThread(record, loadersFor([INSTAGRAM, LINKEDIN]));
    const { id: _id, createdAt: _c, updatedAt: _u, ...input } = record;
    expect(json(toStoredThread(restored))).toEqual(input);
  });

  it("fails the reopen when a template cannot be loaded, rather than call it gone", async () => {
    const loaders = {
      getTemplate: vi.fn(async () => {
        throw new Error("Failed to fetch");
      }),
      companyId: "co-1",
    };
    await expect(fromStoredThread(recordOf(saved()), loaders)).rejects.toThrow("Failed to fetch");
  });
});
