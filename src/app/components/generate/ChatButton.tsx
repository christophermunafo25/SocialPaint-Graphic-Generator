import React, { forwardRef } from "react";

type ChatButtonProps = {
  kind: "primary" | "secondary" | "tertiary" | "accent";
  size?: "default" | "small";
  /** Leading glyph, drawn at 16px in the label colour (HistoryIcon,
   * NewChatIcon, or a lucide icon). Decoration: the label names the button. */
  icon?: React.ReactNode;
} & React.ButtonHTMLAttributes<HTMLButtonElement>;

/** The Generate chat's text button (Figma "Generate · Chat", sp-button
 * 283:31): a solid fill with no border, no outline and no shadow, so it can
 * never be mistaken for a suggestion chip. Primary is Slime, secondary Deep
 * Moss (light) or white (dark), tertiary the sunken neutral, accent Deep
 * Moss with Slime text (light) or the inverse (dark); every colour
 * comes from the --gen-btn-* tokens, so the theme lives in CSS. Default is
 * 44 tall, small 36. Scoped to Generate: the rest of the app keeps .sp-btn.
 * The label is its own element so a narrow layout can hide it visually
 * and keep it as the button's name (the thread header on a phone). */
export const ChatButton = forwardRef<HTMLButtonElement, ChatButtonProps>(function ChatButton(
  { kind, size = "default", icon, type = "button", className, children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={className ? `sp-chat-btn ${className}` : "sp-chat-btn"}
      data-kind={kind}
      data-size={size}
      {...rest}
    >
      {icon && (
        <span className="sp-chat-btn__icon" aria-hidden>
          {icon}
        </span>
      )}
      <span className="sp-chat-btn__label">{children}</span>
    </button>
  );
});
