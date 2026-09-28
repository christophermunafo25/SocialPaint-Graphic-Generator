import React from "react";
import { BrandMark } from "../BrandMark";

/** The byline over each assistant turn in a Generate chat (Figma
 * "Generate · Chat", sp-chat-assistant-header 328:854): the SocialPaint
 * mark at 20px, then the name, 10px apart. The mark is the shared
 * `BrandMark`, Slime in both themes, so nothing here flips with the
 * colour scheme. */
export function AssistantHeader() {
  return (
    <div className="sp-chat-assistant-header">
      <BrandMark width={20} />
      <span className="sp-chat-assistant-header__name">SocialPaint</span>
    </div>
  );
}
