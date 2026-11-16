import React from "react";
import { Undo2 } from "lucide-react";
import { routeToUrl, useRouter } from "../../../router";
import { Button, PageHeader } from "../../primitives";
import type { BrandDraft } from "./kitPlumbing";

const clockTime = (at: number) =>
  new Date(at).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });

/** A detail page's header (every Brand Studio detail frame, 13:10088): the
 * breadcrumb "Brand Studio" / the page, whose last crumb is the page's
 * heading, then the save status and Undo, 16 apart. "Brand Studio" stays a
 * real link. The status reads "Saving…" while a write is in flight and the
 * time of the last save after one (PHASE-6 §9 D7 to D9), "All changes
 * saved" before. Undo is disabled with nothing to take back; ⌘Z still
 * works, unhinted. */
export function BrandDetailHeader({ title, brand }: { title: string; brand: BrandDraft }) {
  const { navigate } = useRouter();
  const { saving, savedAt, canUndo, undo } = brand;
  return (
    <PageHeader
      crumbs={[
        {
          label: "Brand Studio",
          href: routeToUrl({ name: "brandStudio" }),
          onClick: () => navigate({ name: "brandStudio" }),
        },
        { label: title },
      ]}
      status={saving ? "Saving…" : savedAt ? `Saved ${clockTime(savedAt)}` : "All changes saved"}
      actions={
        <Button kind="neutral" icon={Undo2} disabled={!canUndo} onClick={() => undo()}>
          Undo
        </Button>
      }
    />
  );
}
