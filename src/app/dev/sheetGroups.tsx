import React from "react";
import { Download, Globe, Loader2, Minus, Settings, X } from "lucide-react";
import {
  AttachButton,
  Button,
  Chip,
  ChoiceChip,
  DetailTag,
  PlatformChip,
  Status,
  Tag,
  CompactSelect,
  Field,
  Filter,
  Input,
  SearchField,
  SegmentedControl,
  Select,
  Switch,
  Tabs,
  TextArea,
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
  {
    title: "Fields and pickers",
    render: () => <FieldsGroup />,
  },
  {
    title: "Toggles",
    render: () => <TogglesGroup />,
  },
  {
    title: "Chips and tags",
    render: () => <ChipsGroup />,
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

const LOOKS = [
  { value: "moss", label: "Moss" },
  { value: "lime", label: "Lime" },
  { value: "ocean", label: "Ocean" },
];

function FieldsGroup() {
  const [look, setLook] = React.useState("moss");
  const [platform, setPlatform] = React.useState("");
  const [query, setQuery] = React.useState("");
  const [open, setOpen] = React.useState(false);
  return (
    <div className="dev-ui-sheet__panel">
      <div className="dev-ui-w-288 dev-ui-sheet__stack">
        <Field label="Headline">
          <Input placeholder="Creative Director" />
        </Field>
        <Field label="Headline" error="Add a headline.">
          <Input />
        </Field>
        <Field label="Location">
          <Input size="sm" placeholder="Chicago" />
        </Field>
        <Field label="Description">
          <TextArea placeholder="What the role is and who it is for." />
        </Field>
        <Field label="Disabled">
          <Input disabled value="Locked by the template" readOnly />
        </Field>
      </div>
      <div className="dev-ui-w-288 dev-ui-sheet__stack">
        <Field label="Look">
          <Select ariaLabel="Look" value={look} options={LOOKS} onSelect={setLook} />
        </Field>
        <Field label="Look, large">
          <Select
            ariaLabel="Look, large"
            size="lg"
            value={look}
            options={LOOKS}
            onSelect={setLook}
          />
        </Field>
        <Select
          ariaLabel="Look, disabled"
          value={undefined}
          placeholder="Pick a look"
          options={LOOKS}
          onSelect={setLook}
          disabled
        />
        <div className="dev-ui-sheet__line">
          <CompactSelect
            ariaLabel="Platform"
            value={platform}
            options={[
              { value: "", label: "Any platform" },
              { value: "instagram", label: "Instagram" },
              { value: "linkedin", label: "LinkedIn" },
            ]}
            onSelect={setPlatform}
          />
          <Filter aria-haspopup="menu" aria-expanded={false}>
            Last 30 days
          </Filter>
        </div>
        <SearchField
          open={open}
          onOpenChange={setOpen}
          value={query}
          onChange={setQuery}
          onClear={() => setQuery("")}
          label="Search templates"
          placeholder="Search templates"
        />
      </div>
    </div>
  );
}

function TogglesGroup() {
  const [on, setOn] = React.useState(true);
  const [off, setOff] = React.useState(false);
  const [platform, setPlatform] = React.useState("instagram");
  const [metric, setMetric] = React.useState("exports");
  return (
    <div className="dev-ui-sheet__panel">
      <Switch checked={on} onChange={setOn} ariaLabel="Allow photo uploads" />
      <Switch checked={off} onChange={setOff} ariaLabel="Fields may override type styles" />
      <Switch checked={false} onChange={() => {}} ariaLabel="Disabled switch" disabled />
      <SegmentedControl
        aria-label="Platform"
        options={[
          { id: "instagram", label: "Instagram" },
          { id: "linkedin", label: "LinkedIn" },
        ]}
        selectedId={platform}
        onSelect={setPlatform}
      />
      <Tabs
        aria-label="Metric"
        items={[
          { id: "exports", label: "Exports", dot: "green" },
          { id: "opens", label: "Opens", dot: "blue" },
          { id: "links", label: "Links", dot: "purple" },
        ]}
        selectedId={metric}
        onSelect={setMetric}
      />
    </div>
  );
}

function ChipsGroup() {
  const [role, setRole] = React.useState("primary");
  const [platform, setPlatform] = React.useState<"all" | "instagram" | "linkedin">("all");
  return (
    <>
      <div className="dev-ui-sheet__line">
        <Chip>Add a location</Chip>
        <Chip>Make a Facebook version</Chip>
        <Chip disabled>Disabled</Chip>
      </div>
      <div className="dev-ui-sheet__panel">
        {["primary", "secondary", "accent"].map((r) => (
          <ChoiceChip key={r} selected={role === r} onClick={() => setRole(r)}>
            {r[0].toUpperCase() + r.slice(1)}
          </ChoiceChip>
        ))}
        <Tag>Primary</Tag>
        <Tag kind="overlay">On media</Tag>
        <DetailTag icon={Globe} removeLabel="Remove socialpaint.ai/careers">
          socialpaint.ai/careers
        </DetailTag>
        <DetailTag state="sent">Remote</DetailTag>
        <Status tone="positive">Connected</Status>
        <Status tone="active">Active</Status>
        <Status tone="neutral">Expired</Status>
        <Status tone="positive" size="sm">
          Connected
        </Status>
      </div>
      <div className="dev-ui-sheet__line" role="radiogroup" aria-label="Platform">
        {(["all", "instagram", "linkedin"] as const).map((p) => (
          <PlatformChip
            key={p}
            platform={p}
            role="radio"
            aria-checked={platform === p}
            selected={platform === p}
            onClick={() => setPlatform(p)}
          >
            {p === "all" ? "All" : p === "instagram" ? "Instagram" : "LinkedIn"}
          </PlatformChip>
        ))}
        <Tag kind="filter">Hiring</Tag>
        <Tag kind="missing">Location</Tag>
      </div>
    </>
  );
}
