import React from "react";
import { Download, Loader2, Minus, Settings, X } from "lucide-react";
import {
  AttachButton,
  Button,
  IconButton,
  RowMenuTrigger,
  SendButton,
  Stepper,
  StepperButton,
  ThemeToggle,
  type ButtonKind,
  type ButtonSize,
} from "@/app/components/primitives";

export interface SheetGroup {
  title: string;
  render(): React.ReactNode;
}

const KINDS: ButtonKind[] = ["primary", "neutral", "neutralOnPage", "destructive"];
const SIZES: ButtonSize[] = ["lg", "md", "default", "sm"];

/** The component sheet's groups, one per family, in build order. */
export const SHEET_GROUPS: SheetGroup[] = [
  {
    title: "Buttons",
    render: () => (
      <>
        {KINDS.map((kind) => (
          <div key={kind} className="dev-ui-sheet__line">
            {SIZES.map((size) => (
              <Button key={size} kind={kind} size={size}>
                Button
              </Button>
            ))}
            <Button kind={kind} icon={Download}>
              Download
            </Button>
            <Button kind={kind} icon={Loader2} aria-busy="true">
              Saving
            </Button>
            <Button kind={kind} disabled>
              Disabled
            </Button>
          </div>
        ))}
        <div className="dev-ui-sheet__line">
          <SendButton label="Send" />
          <SendButton label="Stop" action="stop" />
          <AttachButton label="Attach" />
        </div>
      </>
    ),
  },
  {
    title: "Icon buttons",
    render: () => <IconButtonsGroup />,
  },
];

function IconButtonsGroup() {
  const [value, setValue] = React.useState(1);
  return (
    <div className="dev-ui-sheet__panel">
      <IconButton icon={X} label="Close" />
      <IconButton icon={X} label="Close (disabled)" disabled />
      <IconButton variant="ghost" icon={Settings} label="Settings" />
      <IconButton variant="ghost" icon={Settings} label="Settings (selected)" selected />
      <IconButton variant="ghost" icon={Settings} label="Settings (disabled)" disabled />
      <RowMenuTrigger label="More actions" aria-haspopup="menu" aria-expanded={false} />
      <RowMenuTrigger label="More actions (disabled)" disabled />
      <ThemeToggle label="Switch theme" />
      <StepperButton icon={Minus} label="Decrease (disabled)" disabled />
      <Stepper label="Variations" value={value} min={1} max={3} onChange={setValue} />
    </div>
  );
}
