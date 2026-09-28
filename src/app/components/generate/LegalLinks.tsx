import React from "react";
import { PRIVACY_URL, TERMS_URL } from "@/lib/legalLinks";

/** The Terms of Service and Privacy Policy links (PROMPT §11.3), as the
 * Generate frames draw them under the Start state, beside the composer
 * footnote and under History: 12/125% Regular in the muted ink, underlined.
 * They leave the app, so they open in a new tab with the opener cut. The
 * row's spacing belongs to the caller's row (16 apart on the Start state
 * and History, 12 in the footnote), so these render as bare siblings. */
export function LegalLinks() {
  return (
    <>
      <a className="sp-chat-legal" href={TERMS_URL} target="_blank" rel="noopener noreferrer">
        Terms of Service
      </a>
      <a className="sp-chat-legal" href={PRIVACY_URL} target="_blank" rel="noopener noreferrer">
        Privacy Policy
      </a>
    </>
  );
}

/** The thread dock's footnote row (PROMPT §8.4): the Brand Studio line,
 * then the legal links, 12 apart in the muted ink. Shared by the chat and
 * the saved chat's loading state, whose dock stands in for it. */
export function ChatFootnote() {
  return (
    <p className="sp-chat-footnote">
      <span>Every graphic follows your Brand Studio rules.</span>
      <LegalLinks />
    </p>
  );
}
