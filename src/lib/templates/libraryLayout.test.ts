import { describe, expect, it } from "vitest";
import { SHELF_CARD_WIDTH, cardsPerRow, libraryLayout } from "./libraryLayout";

describe("cardsPerRow", () => {
  it("counts the 302 cards a row shows in full, gap apart", () => {
    expect(SHELF_CARD_WIDTH).toBe(302);
    // Three cards and two gaps need 938; a fourth needs 1256.
    expect(cardsPerRow(938, 16)).toBe(3);
    expect(cardsPerRow(937, 16)).toBe(2);
    expect(cardsPerRow(1055, 16)).toBe(3);
    expect(cardsPerRow(1256, 16)).toBe(4);
  });

  it("reads the gap it is given", () => {
    expect(cardsPerRow(940, 24)).toBe(2);
    expect(cardsPerRow(954, 24)).toBe(3);
  });

  it("is at least one once the width is known, and zero before", () => {
    expect(cardsPerRow(280, 16)).toBe(1);
    expect(cardsPerRow(0, 16)).toBe(0);
    expect(cardsPerRow(Number.NaN, 16)).toBe(0);
  });
});

describe("libraryLayout", () => {
  it("is one grid when every shelf fits in a row", () => {
    // The six starters: five shelves, the largest holding two.
    expect(libraryLayout([2, 1, 1, 1, 1], 3)).toBe("grid");
    expect(libraryLayout([3, 1], 3)).toBe("grid");
  });

  it("is shelves once any shelf overflows its row", () => {
    expect(libraryLayout([4, 1, 1], 3)).toBe("shelves");
    // The same library on a phone, where a row holds one card.
    expect(libraryLayout([2, 1, 1, 1, 1], 1)).toBe("shelves");
  });

  it("keeps the shelves until the width is known", () => {
    expect(libraryLayout([1, 1], 0)).toBe("shelves");
  });
});
