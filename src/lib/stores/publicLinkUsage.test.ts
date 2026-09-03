import { describe, expect, it } from "vitest";
import { joinLinkUsage, type LinkEvent, type LinkRecord } from "./publicLinkUsage";

const link = (over: Partial<LinkRecord> & { id: string }): LinkRecord => ({
  name: "A link",
  templateId: "t1",
  templateName: "Attendee announcement",
  revokedAt: null,
  createdAt: "2026-08-01T00:00:00.000Z",
  ...over,
});

const ev = (linkId: string, action: LinkEvent["action"], createdAt: string): LinkEvent => ({
  linkId,
  action,
  createdAt,
});

describe("joinLinkUsage", () => {
  it("names bulk_export without counting it: a public link has no bulk path", () => {
    const rows = joinLinkUsage(
      [link({ id: "a" })],
      [
        ev("a", "bulk_export", "2026-08-02T10:00:00.000Z"),
        ev("a", "download", "2026-08-02T11:00:00.000Z"),
      ],
    );
    expect(rows[0]).toMatchObject({ opens: 0, downloads: 1, shares: 0 });
  });

  it("counts opens and exports per link", () => {
    const rows = joinLinkUsage(
      [link({ id: "a", name: "Thank-you page" })],
      [
        ev("a", "open", "2026-08-01T10:00:00.000Z"),
        ev("a", "open", "2026-08-02T10:00:00.000Z"),
        ev("a", "download", "2026-08-02T11:00:00.000Z"),
      ],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ linkName: "Thank-you page", opens: 2, downloads: 1 });
  });

  it("keeps a link with no traffic, which is the point of the table", () => {
    // "Created it, nobody has opened it" is one of the more useful things an
    // admin can learn here — an inner join would drop exactly that row.
    const rows = joinLinkUsage([link({ id: "a", name: "Sponsor packet" })], []);
    expect(rows).toEqual([
      expect.objectContaining({
        linkName: "Sponsor packet",
        opens: 0,
        downloads: 0,
        lastUsedAt: null,
      }),
    ]);
  });

  it("keeps two links to the same template apart", () => {
    const rows = joinLinkUsage(
      [link({ id: "a", name: "Thank-you page" }), link({ id: "b", name: "Speaker email" })],
      [
        ev("a", "open", "2026-08-01T10:00:00.000Z"),
        ev("a", "download", "2026-08-01T10:05:00.000Z"),
        ev("b", "open", "2026-08-01T10:00:00.000Z"),
      ],
    );
    const byName = Object.fromEntries(rows.map((r) => [r.linkName, r]));
    expect(byName["Thank-you page"]).toMatchObject({ opens: 1, downloads: 1 });
    expect(byName["Speaker email"]).toMatchObject({ opens: 1, downloads: 0 });
  });

  it("tracks the most recent activity", () => {
    const rows = joinLinkUsage(
      [link({ id: "a" })],
      [
        ev("a", "open", "2026-08-03T10:00:00.000Z"),
        ev("a", "open", "2026-08-01T10:00:00.000Z"),
        ev("a", "download", "2026-08-02T10:00:00.000Z"),
      ],
    );
    expect(rows[0].lastUsedAt).toBe("2026-08-03T10:00:00.000Z");
  });

  it("ignores an event whose link no longer exists", () => {
    // Deleting a link nulls usage_events.link_id, so this should not arise —
    // but if it does, the event must not conjure a row for a link that is
    // gone. It still counts toward its template's totals elsewhere.
    const rows = joinLinkUsage(
      [link({ id: "a" })],
      [ev("ghost", "download", "2026-08-01T10:00:00.000Z")],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].downloads).toBe(0);
  });

  it("carries revocation through, so stalled counts have an explanation", () => {
    const rows = joinLinkUsage(
      [link({ id: "a", revokedAt: "2026-08-05T00:00:00.000Z" })],
      [ev("a", "open", "2026-08-01T10:00:00.000Z")],
    );
    expect(rows[0].revokedAt).toBe("2026-08-05T00:00:00.000Z");
  });

  it("sorts the link that is working to the top", () => {
    const rows = joinLinkUsage(
      [
        link({ id: "quiet", name: "Quiet" }),
        link({ id: "busy", name: "Busy" }),
        link({ id: "opened", name: "Opened only" }),
      ],
      [
        ev("busy", "download", "2026-08-01T10:00:00.000Z"),
        ev("busy", "download", "2026-08-01T11:00:00.000Z"),
        ev("opened", "open", "2026-08-01T10:00:00.000Z"),
      ],
    );
    expect(rows.map((r) => r.linkName)).toEqual(["Busy", "Opened only", "Quiet"]);
  });

  it("counts shares apart from downloads", () => {
    const rows = joinLinkUsage(
      [link({ id: "a" })],
      [
        ev("a", "open", "2026-08-01T10:00:00.000Z"),
        ev("a", "download", "2026-08-01T10:01:00.000Z"),
        ev("a", "download", "2026-08-01T10:02:00.000Z"),
        ev("a", "share", "2026-08-01T10:03:00.000Z"),
      ],
    );
    // Two exports, one of which went to LinkedIn — the gap is the point.
    expect(rows[0]).toMatchObject({ opens: 1, downloads: 2, shares: 1 });
  });

  it("counts a share toward last-used", () => {
    const rows = joinLinkUsage(
      [link({ id: "a" })],
      [
        ev("a", "download", "2026-08-01T10:00:00.000Z"),
        ev("a", "share", "2026-08-04T10:00:00.000Z"),
      ],
    );
    expect(rows[0].lastUsedAt).toBe("2026-08-04T10:00:00.000Z");
  });
});
