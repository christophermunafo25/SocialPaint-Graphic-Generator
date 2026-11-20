import React, { useEffect, useRef, useState } from "react";
import { Plus } from "lucide-react";
import watercolor from "@/assets/socialpaint/watercolor.webp";
import { IconButton, SendButton, Stepper } from "../primitives";

/** The right-hand panel of the gate and onboarding (`sp-auth-panel`, Figma
 * 6101:661): the watercolor art under a 20% scrim, and a card centred on
 * it. Decorative: hidden from assistive tech, inert, never focusable, and
 * the art loads after the form. It keeps the light token set in every
 * theme, as the frames draw it. */
export function AuthPanel({ children }: { children?: React.ReactNode }) {
  // React 18 drops a boolean `inert`, so it's set on the element directly.
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => ref.current?.setAttribute("inert", ""), []);
  return (
    <div ref={ref} className="sp-auth__panel" data-theme="light" aria-hidden>
      <img className="sp-auth__art" src={watercolor} alt="" loading="lazy" decoding="async" />
      {children}
    </div>
  );
}

/** The gate panel's composer (Figma 6101:662): the message, then Attach on
 * the left and the count and Send on the right, drawn from the primitives
 * as an illustration (PHASE-8B §9 D6). Nothing in it responds; the panel
 * around it is inert. */
export function ComposerIllustration() {
  const [count, setCount] = useState(1);
  return (
    <div className="sp-auth__card sp-auth-composer">
      <p className="t-body-l sp-auth-composer__prompt">
        Make a hiring post for our creative director role
      </p>
      <div className="sp-auth-composer__toolbar">
        <IconButton icon={Plus} label="Attach" tabIndex={-1} />
        <span className="sp-auth-composer__spacer" />
        <Stepper label="Variations" value={count} min={1} max={3} onChange={setCount} />
        <SendButton label="Send" tabIndex={-1} />
      </div>
    </div>
  );
}
