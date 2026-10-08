import React from "react";
import photoPlaceholder from "@/assets/socialpaint/photo-placeholder.jpg";
import { PublicLinksBody } from "../components/admin/TemplateLinksDialog";
import {
  AddColorButton,
  ColorCard,
  ColorDot,
  ProgressSegments,
  Question,
  WorkspacePreview,
} from "../components/onboarding/pieces";
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
  Upload,
  ThemeToggle,
  Toast,
  Tooltip,
  OptionTile,
  OptionRadioGroup,
  OptionCheckboxGroup,
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
  {
    title: "Onboarding (Phase 8b)",
    render: () => <OnboardingGroup />,
  },
];

/** Onboarding's pieces (Figma 257:2): the Option tile in its states and
 * groups, the progress bar, colours and the workspace preview. */
function OnboardingGroup() {
  const [role, setRole] = React.useState<string | undefined>("marketing");
  const [makers, setMakers] = React.useState<string[]>(["team"]);
  return (
    <>
      <div className="dev-ui-sheet__line">
        <OptionTile label="Default" icon={Sparkles} selected={false} style={{ width: 234 }} />
        <OptionTile
          label="Hover"
          icon={Sparkles}
          selected={false}
          data-demo-state="hover"
          style={{ width: 234 }}
        />
        <OptionTile label="Selected" icon={Sparkles} selected style={{ width: 234 }} />
        <OptionTile
          label="Focus"
          icon={Sparkles}
          selected={false}
          data-demo-state="focus"
          style={{ width: 234 }}
        />
      </div>
      <div className="dev-ui-sheet__panel" style={{ width: 480, display: "grid", gap: 32 }}>
        <ProgressSegments done={2} />
        <Question label="What is your role?" labelId="dev-role">
          <OptionRadioGroup
            aria-labelledby="dev-role"
            layout="grid"
            value={role}
            onChange={setRole}
            options={[
              { value: "marketing", label: "Marketing", icon: Sparkles },
              { value: "design", label: "Design", icon: Pencil },
              { value: "people", label: "People and recruiting", icon: Users },
              { value: "other", label: "Something else", icon: Globe },
            ]}
          />
        </Question>
        <Question label="Who will be making graphics?" labelId="dev-makers">
          <OptionCheckboxGroup
            aria-labelledby="dev-makers"
            layout="hug"
            values={makers}
            onChange={setMakers}
            options={[
              { value: "team", label: "My marketing team" },
              { value: "employees", label: "Employees across the company" },
              { value: "me", label: "Just me" },
            ]}
          />
        </Question>
        <Question label="What are your brand colors?" error="Pick a color first.">
          <div className="sp-onb-colors">
            <ColorDot hex="#0F4C5C" name="Deep teal" onRemove={() => {}} />
            <ColorDot hex="#2EC4B6" name="Teal" />
            <AddColorButton shape="dot" />
          </div>
        </Question>
        <div className="sp-onb-colors" data-cards>
          <ColorCard hex="#0F4C5C" name="Deep teal" />
          <ColorCard hex="#F7F4EC" name="Paper" />
          <AddColorButton shape="tile" />
        </div>
      </div>
      <div className="dev-ui-sheet__panel" data-theme="light">
        <WorkspacePreview state={{ person: { name: "Jordan Lee", detail: "Marketing" } }} />
        <WorkspacePreview
          state={{
            person: { name: "Jordan Lee", detail: "Marketing" },
            workspace: { name: "Acme Studios", detail: "My company · 11–50 people" },
            firstUp: { title: "Hiring posts", detail: "LinkedIn" },
            brand: { colors: ["#0F4C5C", "#2EC4B6", "#FFBF69", "#F7F4EC"], font: "Manrope" },
          }}
        />
      </div>
    </>
  );
}

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

/** A portrait for the Upload specimen: the placeholder the template cards
 * use. */
const SAMPLE_PHOTO = photoPlaceholder;

/** Sample looks and a link for the Public links dialog (168:758): the
 * local backend issues no links. */
const SAMPLE_LOOKS = [
  { id: "moss", name: "Moss", isDefault: true, overrides: {} },
  { id: "lime", name: "Lime", overrides: {} },
  { id: "ocean", name: "Ocean", overrides: {} },
];
const SAMPLE_LINKS = [
  {
    id: "link-1",
    companyId: "co",
    templateId: "tpl",
    name: "Recruiting partners",
    allowUploads: true,
    pinnedVariantId: null,
    expiresAt: null,
    useCap: null,
    useCount: 37,
    revokedAt: null,
    createdAt: "2026-09-14T12:00:00.000Z",
    lastUsedAt: "2026-09-30T12:00:00.000Z",
  },
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
        <Field label="Location" edited optional>
          <Input defaultValue="Remote" />
        </Field>
        <Field label="Caption" action={{ label: "Copy", onClick: () => {} }}>
          <TextArea defaultValue="Come paint with us." />
        </Field>
        <Field label="Photo" optional>
          <Upload placeholder="Add a photo" />
        </Field>
        <Upload placeholder="Add a photo" thumbnail={SAMPLE_PHOTO} fileName="portrait.jpg" />
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
        <ProgressBar label="Uploading" />
      </SettingsCard>
      <ModalPanel title="Public links" icon={Link}>
        <PublicLinksBody
          state="ready"
          variants={SAMPLE_LOOKS}
          defaults={{ allowUploads: true, expiryDays: null, useCap: null }}
          links={SAMPLE_LINKS}
          loadError={false}
          onRetryLoad={() => {}}
          busy={false}
          error={null}
          freshUrl={null}
          missingAssets={null}
          onCreate={() => {}}
          onRevoke={() => {}}
          onRegenerate={() => {}}
          onPin={() => {}}
          onToggleUploads={() => {}}
        />
      </ModalPanel>
      <Modal open={open} onOpenChange={setOpen} title="Public links" icon={Link}>
        <Field label="Headline">
          <Input placeholder="Creative Director" />
        </Field>
      </Modal>
    </>
  );
}
