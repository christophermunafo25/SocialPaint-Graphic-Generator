import React from "react";
import { PRIVACY_URL, TERMS_URL } from "@/lib/legalLinks";

/** The Terms of Service and Privacy Policy links (PROMPT §11.3), as the
 * new look draws them under Generate's Start state, its dock and History:
 * 12/125% Regular in the muted ink, underlined.
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
