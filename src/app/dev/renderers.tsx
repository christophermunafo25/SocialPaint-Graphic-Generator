import type React from "react";
import { Minus, Settings, X } from "lucide-react";
import {
  AttachButton,
  Button,
  CompactSelect,
  Filter,
  SearchField,
  Select,
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
  Input: (s) => (
    <div
      className="ui-reset ui-tint ui-input t-body-s dev-ui-input-demo dev-ui-w-288"
      data-demo-state={s === "hover" ? "hover" : undefined}
    >
      {s === "focus" && <span className="dev-ui-input-demo__caret" aria-hidden />}
      Creative Director
    </div>
  ),
  Select: (s) => (
    <Select
      ariaLabel="Look"
      value="moss"
      options={[{ value: "moss", label: "Moss" }]}
      onSelect={() => {}}
      className="dev-ui-w-200"
      data-demo-state={demo(s)}
    />
  ),
  "Compact select": (s) => (
    <CompactSelect
      ariaLabel="Platform"
      value=""
      options={[{ value: "", label: "Any platform" }]}
      onSelect={() => {}}
      data-demo-state={demo(s)}
    />
  ),
  Filter: (s) => <Filter data-demo-state={demo(s)}>Last 30 days</Filter>,
  "Search field": (s) => (
    <SearchField
      open={s === "open"}
      onOpenChange={() => {}}
      value="hiring"
      onChange={() => {}}
      onClear={() => {}}
      label="Search templates"
      focusOnOpen={false}
      className="dev-ui-w-288"
      data-demo-state={s === "open" ? undefined : demo(s)}
    />
  ),
};
