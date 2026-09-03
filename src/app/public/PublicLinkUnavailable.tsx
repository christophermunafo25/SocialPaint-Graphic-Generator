import React from "react";
import { RefreshCw } from "lucide-react";
import type { PublicLinkFailure } from "@/lib/publicLink/client";

/** What a visitor sees when a link doesn't open.
 *
 * Expired, revoked, used up, unpublished, and never-existed are ONE message,
 * because the server refuses them identically and the page must not invent a
 * distinction it cannot know. That constraint turns out to be the right copy
 * anyway: a speaker cannot act on "revoked" versus "expired". They can act
 * on "ask the person who sent this for a new one", which is what the message
 * says. No error codes, and nothing that reads like a system talking to
 * itself.
 *
 * The two states that ARE genuinely different get their own message, because
 * both are recoverable by the visitor: a connection problem and a link
 * that's briefly overloaded. */
export function PublicLinkUnavailable({
  reason,
  onRetry,
}: {
  reason: PublicLinkFailure;
  onRetry?(): void;
}) {
  const copy = MESSAGES[reason];
  return (
    <div
      className="flex flex-col items-center justify-center text-center"
      style={{ minHeight: "60vh", gap: "var(--space-xs)" }}
    >
      <div style={{ maxWidth: 440 }}>
        <h1 className="sp-page-title">{copy.title}</h1>
        <p
          style={{
            fontSize: "var(--type-label-size)",
            color: "var(--text-secondary)",
            marginTop: "var(--space-2xs)",
          }}
        >
          {copy.detail}
        </p>
      </div>
      {copy.retryable && onRetry && (
        <button
          onClick={onRetry}
          className="sp-btn sp-btn-primary"
          style={{ marginTop: "var(--space-2xs)" }}
        >
          <RefreshCw style={{ width: 14, height: 14 }} />
          Try again
        </button>
      )}
    </div>
  );
}

const MESSAGES: Record<PublicLinkFailure, { title: string; detail: string; retryable: boolean }> = {
  unavailable: {
    title: "This link isn't working anymore.",
    detail:
      "Links get switched off or expire after an event. Ask whoever sent it for a fresh one. It takes them seconds to make.",
    retryable: false,
  },
  "rate-limited": {
    title: "Give it a moment.",
    detail: "A lot of people are opening this link right now. Wait about a minute and try again.",
    retryable: true,
  },
  offline: {
    title: "We couldn't reach SocialPaint.",
    detail: "Check your connection and try again. The link itself is probably fine.",
    retryable: true,
  },
};
