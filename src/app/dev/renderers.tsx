import type React from "react";
import { Building, Globe, Image, Minus, Settings, Sparkles, X } from "lucide-react";
import {
  AttachButton,
  Button,
  Chip,
  ChoiceChip,
  DetailTag,
  PlatformChip,
  ResultCard,
  Tag,
  CompactSelect,
  Filter,
  SearchField,
  Segment,
  Select,
  SettingsRailItem,
  Switch,
  Tab,
  IconButton,
  LookTile,
  MenuItemStatic,
  NavItem,
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
  Switch: (s) => (
    <Switch
      checked={s === "on"}
      onChange={() => {}}
      ariaLabel="Allow photo uploads"
      data-demo-state={demo(s)}
    />
  ),
  Segment: (s) => (
    <Segment selected={s === "selected"} data-demo-state={demo(s)}>
      Instagram
    </Segment>
  ),
  Tab: (s) => (
    <Tab dot="green" selected={s === "selected"} data-demo-state={demo(s)}>
      Exports
    </Tab>
  ),
  Chip: (s) => <Chip data-demo-state={demo(s)}>Add a location</Chip>,
  "Choice chip": (s) => (
    <ChoiceChip selected={s === "selected"} data-demo-state={demo(s)}>
      Primary
    </ChoiceChip>
  ),
  "Platform chip": (s) => (
    <PlatformChip platform="all" selected={s === "selected"} data-demo-state={demo(s)}>
      All
    </PlatformChip>
  ),
  "Tag · Filter": (s) => (
    <Tag kind="filter" data-demo-state={demo(s)}>
      Hiring
    </Tag>
  ),
  "Detail tag": (s) => (
    <DetailTag icon={Globe} removeLabel="Remove socialpaint.ai/careers" data-demo-state={demo(s)}>
      socialpaint.ai/careers
    </DetailTag>
  ),
  "Nav item": (s) => (
    <NavItem
      icon={Sparkles}
      selected={s === "selected"}
      className="dev-ui-w-285"
      data-demo-state={demo(s)}
    >
      Generate
    </NavItem>
  ),
  "Settings rail item": (s) => (
    <SettingsRailItem
      icon={Building}
      selected={s === "selected"}
      className="dev-ui-w-200"
      data-demo-state={demo(s)}
    >
      Workspace
    </SettingsRailItem>
  ),
  "Menu item": (s) => (
    <MenuItemStatic
      icon={Image}
      selected={s === "selected"}
      className="dev-ui-w-288"
      data-demo-state={s === "focus" ? "hover" : demo(s)}
    >
      Photo
    </MenuItemStatic>
  ),
  "Result card": (s) => (
    <ResultCard
      title="Now hiring"
      meta="1080 × 1350"
      preview={<span className="dev-ui-sample-preview" />}
      onEdit={() => {}}
      editLabel="Edit Now hiring"
      onDownload={() => {}}
      downloadLabel="Download Now hiring"
      className="dev-ui-w-227"
      data-demo-state={s === "static" ? undefined : "hover"}
    />
  ),
  "Look tile": (s) => (
    <LookTile
      name="Moss"
      thumbnail={<span className="dev-ui-sample-thumb" />}
      selected={s === "selected"}
      data-demo-state={demo(s)}
    />
  ),
};
