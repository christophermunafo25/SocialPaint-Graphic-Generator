import React from "react";
import { LinkedinMono } from "@/lib/templates/platformIcons";

/** The LinkedIn mark at an icon's size, in the text colour around it: the
 * leading icon of "Post to LinkedIn" (159:902). Shaped like a lucide icon
 * so the Button primitive can take it. */
export function LinkedInMark({
  size = 16,
  className,
}: {
  size?: number | string;
  className?: string;
  "aria-hidden"?: boolean | "true" | "false";
}) {
  return <LinkedinMono width={size} height={size} className={className} aria-hidden />;
}
