import React from "react";
import {
  BarChart3,
  Building,
  Download,
  FileText,
  Globe,
  Image,
  Link,
  Loader2,
  Minus,
  Paintbrush,
  Pencil,
  Settings,
  Sparkles,
  Trash2,
  Users,
  X,
} from "lucide-react";
import {
  AttachButton,
  Avatar,
  Button,
  Card,
  Chip,
  ChoiceChip,
  CompactSelect,
  DetailTag,
  Field,
  Filter,
  IconButton,
  Input,
  LookTile,
  Menu,
  MenuDivider,
  MenuItem,
  MenuItemStatic,
  MenuLabel,
  MenuLabelStatic,
  MenuPanel,
  Metric,
  Modal,
  ModalPanel,
  NavItem,
  PlatformChip,
  Progress,
  ProgressBar,
  ResultCard,
  RowMenuTrigger,
  SearchField,
  SegmentedControl,
  Select,
  SendButton,
  SettingsCard,
  SettingsRailItem,
  Stat,
  Status,
  Stepper,
  StepperButton,
  Switch,
  Tabs,
  Tag,
  TextArea,
  ThemeToggle,
  Toast,
  Tooltip,
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
  {
    title: "Navigation, menus and overlays",
    render: () => <NavigationGroup />,
  },
  {
    title: "Previews and containers",
    render: () => <ContainersGroup />,
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

const NAV = [
  { id: "templates", label: "Brand Templates", icon: Paintbrush },
  { id: "generate", label: "Generate", icon: Sparkles },
  { id: "insights", label: "Insights & Analytics", icon: BarChart3 },
];
const RAIL = [
  { id: "workspace", label: "Workspace", icon: Building },
  { id: "people", label: "People", icon: Users },
  { id: "sharing", label: "Sharing", icon: Link },
];

function NavigationGroup() {
  const [page, setPage] = React.useState("generate");
  const [section, setSection] = React.useState("workspace");
  const [attach, setAttach] = React.useState("photo");
  return (
    <>
      <div className="dev-ui-sheet__panel">
        <div className="dev-ui-w-285 dev-ui-sheet__stack">
          {NAV.map((n) => (
            <NavItem
              key={n.id}
              icon={n.icon}
              selected={page === n.id}
              onClick={() => setPage(n.id)}
            >
              {n.label}
            </NavItem>
          ))}
        </div>
        <div className="dev-ui-sheet__stack">
          <Avatar initials="AS" size="lg" label="Acme Studios" />
          <Avatar initials="AS" />
          <Avatar initials="AS" shape="square" />
        </div>
        <Menu trigger={<RowMenuTrigger label="More actions" />} align="end">
          <MenuLabel>Template</MenuLabel>
          <MenuItem icon={Pencil}>Rename</MenuItem>
          <MenuItem icon={FileText} meta="Optional">
            Details
          </MenuItem>
          <MenuDivider />
          <MenuItem icon={Trash2}>Delete</MenuItem>
        </Menu>
        <MenuPanel>
          <MenuLabelStatic>Upload</MenuLabelStatic>
          {["photo", "document", "website"].map((id) => (
            <MenuItemStatic
              key={id}
              icon={id === "photo" ? Image : id === "document" ? FileText : Globe}
              selected={attach === id}
            >
              {id[0].toUpperCase() + id.slice(1)}
            </MenuItemStatic>
          ))}
        </MenuPanel>
      </div>
      <div className="dev-ui-sheet__line">
        <div className="dev-ui-w-200 dev-ui-sheet__stack">
          {RAIL.map((r) => (
            <SettingsRailItem
              key={r.id}
              icon={r.icon}
              selected={section === r.id}
              onClick={() => setSection(r.id)}
            >
              {r.label}
            </SettingsRailItem>
          ))}
        </div>
        <Tooltip label="Tue, Sep 8" value="56 exports" />
        <Toast
          message={"Added \u201cCustom 1\u201d"}
          actionLabel="Undo"
          onAction={() => setAttach("photo")}
        />
      </div>
    </>
  );
}

function ContainersGroup() {
  const [look, setLook] = React.useState("moss");
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <div className="dev-ui-sheet__line">
        <ResultCard
          title="Now hiring"
          meta="1080 × 1350"
          preview={<span className="dev-ui-sample-preview" />}
          onEdit={() => {}}
          editLabel="Edit Now hiring"
          onDownload={() => {}}
          downloadLabel="Download Now hiring"
          className="dev-ui-w-227"
        />
        <div className="dev-ui-sheet__line" role="radiogroup" aria-label="Look">
          {["moss", "lime"].map((id) => (
            <LookTile
              key={id}
              name={id === "moss" ? "Moss" : "Lime"}
              thumbnail={<span className="dev-ui-sample-thumb" />}
              role="radio"
              aria-checked={look === id}
              selected={look === id}
              onClick={() => setLook(id)}
            />
          ))}
        </div>
      </div>
      <Card title="Your month in brief" subtitle="Aug 17 to Sep 15">
        <Metric label="Exports" value="1,046" />
      </Card>
      <SettingsCard
        title="Workspaces"
        action={
          <Button kind="neutral" onClick={() => setOpen(true)}>
            Open modal
          </Button>
        }
      >
        <div className="dev-ui-sheet__line">
          <Stat label="Created" value="Sep 14, 2026" />
          <Progress value={1 / 3} label="1 of 3 · Reading your job post" />
        </div>
        <ProgressBar value={0.4} label="Importing" />
      </SettingsCard>
      <ModalPanel title="Public links" icon={Link}>
        <Field label="Headline">
          <Input placeholder="Creative Director" />
        </Field>
      </ModalPanel>
      <Modal open={open} onOpenChange={setOpen} title="Public links" icon={Link}>
        <Field label="Headline">
          <Input placeholder="Creative Director" />
        </Field>
      </Modal>
    </>
  );
}
