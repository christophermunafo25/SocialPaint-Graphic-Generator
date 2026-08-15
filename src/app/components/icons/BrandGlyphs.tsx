import React, { forwardRef } from "react";
import type { LucideIcon, LucideProps } from "lucide-react";

/** Brand glyphs, kept locally because lucide dropped every logo icon in 1.x
 *  (trademarks aren't theirs to ship). The geometry is lucide's own line
 *  version, lifted verbatim from lucide-static 0.487.0 — ISC licensed — so
 *  these sit on the same 24×24 grid at the same 2px stroke as every other
 *  icon in the app and stay in step with them at any size.
 *
 *  They are typed and built as `LucideIcon`, so anywhere the app already
 *  passes a lucide component around (the platform shelf hands one to a chip)
 *  these drop straight in. A platform shelf and an "import from Figma"
 *  button both need the real mark; a generic square would read as
 *  decoration rather than as the product. */

function glyph(name: string, paths: React.ReactNode): LucideIcon {
  const Icon = forwardRef<SVGSVGElement, LucideProps>(function BrandGlyph(
    {
      color = "currentColor",
      size = 24,
      strokeWidth = 2,
      absoluteStrokeWidth,
      className,
      children,
      ...rest
    },
    ref,
  ) {
    return (
      <svg
        ref={ref}
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke={color}
        // Mirrors lucide: keep the stroke visually constant when the icon is
        // scaled, rather than letting it thicken with the box.
        strokeWidth={
          absoluteStrokeWidth ? (Number(strokeWidth) * 24) / Number(size) : strokeWidth
        }
        strokeLinecap="round"
        strokeLinejoin="round"
        className={["lucide", `lucide-${name}`, className].filter(Boolean).join(" ")}
        {...rest}
      >
        {paths}
        {children}
      </svg>
    );
  });
  Icon.displayName = name;
  return Icon;
}

export const Figma = glyph(
  "figma",
  <>
    <path d="M5 5.5A3.5 3.5 0 0 1 8.5 2H12v7H8.5A3.5 3.5 0 0 1 5 5.5z" />
    <path d="M12 2h3.5a3.5 3.5 0 1 1 0 7H12V2z" />
    <path d="M12 12.5a3.5 3.5 0 1 1 7 0 3.5 3.5 0 1 1-7 0z" />
    <path d="M5 19.5A3.5 3.5 0 0 1 8.5 16H12v3.5a3.5 3.5 0 1 1-7 0z" />
    <path d="M5 12.5A3.5 3.5 0 0 1 8.5 9H12v7H8.5A3.5 3.5 0 0 1 5 12.5z" />
  </>,
);

export const Facebook = glyph(
  "facebook",
  <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />,
);

export const Instagram = glyph(
  "instagram",
  <>
    <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
    <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
  </>,
);

export const Linkedin = glyph(
  "linkedin",
  <>
    <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
    <rect width="4" height="12" x="2" y="9" />
    <circle cx="4" cy="4" r="2" />
  </>,
);

export const Youtube = glyph(
  "youtube",
  <>
    <path d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17" />
    <path d="m10 15 5-3-5-3z" />
  </>,
);
