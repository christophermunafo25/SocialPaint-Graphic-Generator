import { describe, expect, it } from "vitest";
import { plainCaption } from "./captionCopy.ts";

// Emoji, marks and dashes are written as escapes: the repository holds no
// emoji, and an escape shows what an invisible joiner would hide.
const PARTY = "\u{1F389}";
const BABY = "\u{1F476}";
const ZZZ = "\u{1F4A4}";
const FAMILY = "\u{1F468}\u{200D}\u{1F469}\u{200D}\u{1F467}";
const WAVE_MEDIUM_SKIN = "\u{1F44B}\u{1F3FD}";
const FLAG_US = "\u{1F1FA}\u{1F1F8}";
const RED_HEART = "\u{2764}\u{FE0F}";
const KEYCAP_ONE = "1\u{FE0F}\u{20E3}";
const DOUBLE_EXCLAMATION = "\u{203C}\u{FE0F}";
const EXCLAMATION_QUESTION = "\u{2049}";
const INVERTED_EXCLAMATION = "\u{A1}";
const MARKS = "SocialPaint\u{2122} by Acme\u{AE}, \u{A9} 2026";
const EM = "\u{2014}";
const EN = "\u{2013}";

describe("plainCaption", () => {
  it("drops emoji, whole sequences included", () => {
    expect(plainCaption(`Wishing you a healthy year ahead. ${PARTY}`)).toBe(
      "Wishing you a healthy year ahead.",
    );
    expect(plainCaption(`We love our ${BABY} patients`)).toBe("We love our patients");
    expect(plainCaption(`Meet the team ${FAMILY} ${WAVE_MEDIUM_SKIN}`)).toBe("Meet the team");
    expect(plainCaption(`Open in Evanston ${FLAG_US}`)).toBe("Open in Evanston");
    expect(plainCaption(`See you soon ${RED_HEART}.`)).toBe("See you soon.");
    expect(plainCaption(`Step ${KEYCAP_ONE} is a call`)).toBe("Step 1 is a call");
  });

  it("keeps the marks a brand name carries", () => {
    expect(plainCaption(MARKS)).toBe(MARKS);
  });

  it("ends an exclaimed sentence with a full stop", () => {
    expect(plainCaption("Happy New Year! See you soon!")).toBe("Happy New Year. See you soon.");
    expect(plainCaption("Wow!!!")).toBe("Wow.");
    expect(plainCaption("Really?!")).toBe("Really?");
    expect(plainCaption("Is it time? Yes!")).toBe("Is it time? Yes.");
    expect(plainCaption(`Ready${EXCLAMATION_QUESTION}`)).toBe("Ready?");
    expect(plainCaption(`Great news${DOUBLE_EXCLAMATION}`)).toBe("Great news.");
    expect(plainCaption(`${INVERTED_EXCLAMATION}Hola!`)).toBe("Hola.");
  });

  it("turns an em dash into a comma, or drops it at either end of a line", () => {
    expect(plainCaption(`Drop your answer in the comments ${EM} and follow us`)).toBe(
      "Drop your answer in the comments, and follow us",
    );
    expect(plainCaption(`Care${EM}always close`)).toBe("Care, always close");
    expect(plainCaption(`${EM} Dr. Lee`)).toBe("Dr. Lee");
    expect(plainCaption(`Call us today ${EM}`)).toBe("Call us today");
    expect(plainCaption(`Book now ${EM}.`)).toBe("Book now.");
    expect(plainCaption(`Book now! ${PARTY} ${EM} the team`)).toBe("Book now. the team");
    expect(plainCaption(`Thanks ${EM}\nDr. Lee`)).toBe("Thanks\nDr. Lee");
  });

  it("treats a spaced en dash between words as a dash and keeps a range", () => {
    expect(plainCaption(`Same-day visits ${EN} call before noon`)).toBe(
      "Same-day visits, call before noon",
    );
    expect(plainCaption(`Open 9${EN}5 on weekdays`)).toBe(`Open 9${EN}5 on weekdays`);
    expect(plainCaption(`Hours 9 ${EN} 5`)).toBe(`Hours 9 ${EN} 5`);
  });

  it("keeps merge tags and line breaks", () => {
    expect(plainCaption(`{headline}\n\nWishing you well! ${PARTY}`)).toBe(
      "{headline}\n\nWishing you well.",
    );
    expect(plainCaption(`Line one.\n\n${BABY}${ZZZ}\n\nLine two.`)).toBe("Line one.\n\nLine two.");
    expect(plainCaption("Thank you,\nDr. Lee")).toBe("Thank you,\nDr. Lee");
  });

  it("cleans a caption the way the model wrote one on a live import", () => {
    // 2026-11-16: an em dash, an exclamation point and two emoji.
    expect(
      plainCaption(
        `{headline} Drop your answer in the comments ${EM} and follow us for more tips from the team! ${BABY}${ZZZ}`,
      ),
    ).toBe(
      "{headline} Drop your answer in the comments, and follow us for more tips from the team.",
    );
  });

  it("leaves clean copy alone and gives the same answer twice", () => {
    const clean = "Meet {name}, our newest nurse. Bring your records, e.g., vaccination cards.";
    expect(plainCaption(clean)).toBe(clean);
    const once = plainCaption(`Hi! ${PARTY} ${EM} welcome to {clinic} ${EN} see you soon`);
    expect(plainCaption(once)).toBe(once);
  });
});
