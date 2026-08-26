import React from "react";
import mark from "@/assets/socialpaint/mark.svg";

/** The public page's chrome, and there is deliberately very little of it.
 *
 * No sidebar, no nav, no account affordances, and above all no sign-up
 * prompt. The absence of friction IS the feature: someone lands here from a
 * confirmation email at the exact moment they want to post something, and
 * anything between them and the graphic is what kills the conversion this
 * page exists to win. */
export function PublicFrame({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: "var(--bg-canvas)", fontFamily: "var(--font-ui)" }}
    >
      <main className="flex-1 min-w-0">
        <div className="sp-page">{children}</div>
      </main>
      <PublicAttribution />
    </div>
  );
}

/** Attribution: small, quiet, and at the bottom of the page.
 *
 * This link reaches exactly the people worth reaching, and it is the
 * cheapest distribution the product has — but the graphic on this page is
 * the customer's brand moment, not ours. So the mark sits in the footer at
 * caption size, it never touches the canvas, and it is never in the exported
 * PNG. The link opens in a new tab so a half-finished fill is never lost to
 * a stray tap. */
function PublicAttribution() {
  return (
    <footer
      className="flex items-center justify-center"
      style={{
        gap: "var(--space-2xs)",
        padding: "var(--space-md) var(--space-sm)",
        borderTop: "1px solid var(--border)",
      }}
    >
      <img src={mark} alt="" aria-hidden style={{ width: 16, height: "auto", display: "block" }} />
      <span style={{ fontSize: "var(--type-caption-size)", color: "var(--text-muted)" }}>
        Made with{" "}
        <a
          href="https://socialpaint.ai"
          target="_blank"
          rel="noreferrer noopener"
          style={{ color: "var(--text-secondary)", textDecoration: "underline" }}
        >
          SocialPaint
        </a>
      </span>
    </footer>
  );
}
