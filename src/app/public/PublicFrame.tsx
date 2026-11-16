import React from "react";
import { BrandMark } from "../components/BrandMark";

/** The public page's chrome, and there is deliberately very little of it.
 *
 * No sidebar, no nav, no account affordances, and above all no sign-up
 * prompt. The absence of friction IS the feature: someone lands here from a
 * confirmation email at the exact moment they want to post something, and
 * anything between them and the graphic is what kills the conversion this
 * page exists to win. */
export function PublicFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="sp-public">
      <main className="sp-public__main">
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
    <footer className="sp-public__attribution">
      <BrandMark width={16} />
      <span className="t-caption-m">
        Made with{" "}
        <a
          href="https://socialpaint.ai"
          target="_blank"
          rel="noreferrer noopener"
          className="ui-ring sp-public__link"
        >
          SocialPaint
        </a>
      </span>
    </footer>
  );
}
