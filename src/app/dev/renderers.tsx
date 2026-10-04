import type React from "react";
import { Minus, Settings, X } from "lucide-react";
import {
  AttachButton,
  Button,
  IconButton,
  RowMenuTrigger,
  SendButton,
  StepperButton,
  ThemeToggle,
} from "@/app/components/primitives";
import { demo } from "./demo";
import type { DemoState } from "./statesTable";

/** Each Interaction states row's primitive, in a given state, keyed by the
 * row's name. Rows without an entry render empty cells. Sample labels are
 * the frame's. */
export const RENDERERS: Record<string, (state: DemoState) => React.ReactNode> = {
  "Button · Primary": (s) => (
    <Button kind="primary" data-demo-state={demo(s)}>
      Download PNG
    </Button>
  ),
  "Button · Neutral": (s) => (
    <Button kind="neutral" data-demo-state={demo(s)}>
      Copy link
    </Button>
  ),
  "Button · Neutral on page": (s) => (
    <Button kind="neutralOnPage" data-demo-state={demo(s)}>
      Export CSV
    </Button>
  ),
  "Button · Destructive": (s) => (
    <Button kind="destructive" data-demo-state={demo(s)}>
      Delete
    </Button>
  ),
  "Send button": (s) => <SendButton label="Send" data-demo-state={demo(s)} />,
  "Attach button": (s) => <AttachButton label="Attach" data-demo-state={demo(s)} />,
  "Icon button · Filled": (s) => <IconButton icon={X} label="Close" data-demo-state={demo(s)} />,
  "Icon button · Ghost": (s) => (
    <IconButton
      variant="ghost"
      icon={Settings}
      label="Settings"
      selected={s === "selected"}
      data-demo-state={demo(s)}
    />
  ),
  "Row menu trigger": (s) => <RowMenuTrigger label="More actions" data-demo-state={demo(s)} />,
  "Theme toggle": (s) => <ThemeToggle label="Switch theme" data-demo-state={demo(s)} />,
  "Stepper button": (s) => (
    <StepperButton icon={Minus} label="Decrease" data-demo-state={demo(s)} />
  ),
};
