import React from "react";
import { History, Plus } from "lucide-react";
import { Button, PageHeader } from "../primitives";
import { AREA_ICON } from "../areas";

/** Generate's page header over a chat (new brand, 13:2985): "Generate" /
 * the chat's title, then History and New chat, both Neutral. "Generate" starts a
 * new chat. With no title (a saved chat still loading, or one that could
 * not be opened) the trail is "Generate" alone. The ref is the page's,
 * which makes the header inert while the editor's sheet is up. */
export const GenerateHeader = React.forwardRef<
  HTMLElement,
  {
    title: string | null;
    titleId?: string;
    onNewChat(): void;
    onHistory(): void;
  }
>(function GenerateHeader({ title, titleId, onNewChat, onHistory }, ref) {
  return (
    <PageHeader
      ref={ref}
      icon={AREA_ICON.generate}
      currentId={titleId}
      crumbs={
        title
          ? [{ label: "Generate", onClick: onNewChat }, { label: title }]
          : [{ label: "Generate" }]
      }
      actions={
        <>
          <Button kind="neutral" icon={History} onClick={onHistory}>
            History
          </Button>
          <Button kind="neutral" icon={Plus} onClick={onNewChat}>
            New chat
          </Button>
        </>
      }
    />
  );
});
