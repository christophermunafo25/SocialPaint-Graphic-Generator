import React from "react";
import {
  ArrowUp,
  Copy,
  Ellipsis,
  Link,
  Paintbrush,
  Pencil,
  Plus,
  Trash2,
  Undo2,
} from "lucide-react";
import photoPlaceholder from "@/assets/socialpaint/photo-placeholder.jpg";
import {
  Alert,
  Avatar,
  Badge,
  Breadcrumb,
  Button,
  Card,
  Checkbox,
  Chip,
  EmptyState,
  Field,
  FooterLinks,
  IconButton,
  Input,
  MenuDividerStatic,
  MenuItemStatic,
  MenuLabelStatic,
  MenuPanel,
  Metric,
  ModalActions,
  ModalBody,
  ModalPanel,
  NavItem,
  PageHeader,
  Progress,
  ProgressBar,
  Radio,
  Search,
  SearchField,
  Segment,
  SegmentedControl,
  Select,
  SendButton,
  Skeleton,
  Stepper,
  Switch,
  Tab,
  Table,
  TableCell,
  TableRow,
  Tabs,
  Tag,
  TextArea,
  Toast,
  Tooltip,
  Upload,
  type BadgeTone,
  type ButtonKind,
  type TagKind,
} from "@/app/components/primitives";
import type { DemoStateAttr } from "@/app/components/primitives/cx";

/** One variant as the file draws it: the value of each variant property
 * ("State" is "Hover"), and its sample texts in reading order. */
export interface Variant {
  values: Record<string, string>;
  texts: string[];
}

export interface Specimen {
  /** The component takes the width the file gives the variant. Without
   * this it keeps its own, so a difference from the file shows. */
  fill?: boolean;
  render(variant: Variant): React.ReactNode;
}

const noop = () => {};
const SIZE = { Small: "sm", Medium: "md", Large: "lg" } as const;
type FileSize = keyof typeof SIZE;

/** The demo state a file state stands for. Selected, Disabled, Error and
 * the rest are props of the component itself. */
const demo = (state: string | undefined): DemoStateAttr | undefined =>
  state === "Hover"
    ? "hover"
    : state === "Pressed"
      ? "pressed"
      : state === "Focus"
        ? "focus"
        : state === "Open"
          ? "open"
          : undefined;

const MOSS = [{ value: "moss", label: "Moss" }];
const PLATFORMS = ["Instagram", "LinkedIn", "Facebook"].map((label) => ({
  id: label.toLowerCase(),
  label,
}));

const copyAction = (
  <Button kind="neutral" size="sm" icon={Copy}>
    Copy
  </Button>
);

/** Every component on the Components page, keyed by the name the file
 * gives its component set. /dev/ui places each variant where its board
 * does. */
export const SPECIMENS: Record<string, Specimen> = {
  Button: {
    render: ({ values, texts }) => (
      <Button
        kind={values.Kind.toLowerCase() as ButtonKind}
        size={SIZE[values.Size as FileSize]}
        disabled={values.State === "Disabled"}
        data-demo-state={demo(values.State)}
      >
        {texts[0]}
      </Button>
    ),
  },
  "Icon Button": {
    render: ({ values }) => (
      <IconButton
        variant={
          values.Style === "Filled" ? "filled" : values.Style === "Outline" ? "outline" : "ghost"
        }
        size={values.Size === "Small" ? "sm" : "md"}
        icon={Ellipsis}
        label="More actions"
        selected={values.State === "Selected"}
        disabled={values.State === "Disabled"}
        data-demo-state={demo(values.State)}
      />
    ),
  },
  "Send Button": {
    render: ({ values }) => (
      <SendButton
        action={values.Action === "Stop" ? "stop" : "send"}
        label={values.Action}
        disabled={values.State === "Disabled"}
        data-demo-state={demo(values.State)}
      />
    ),
  },
  Input: {
    fill: true,
    render: ({ values, texts }) => {
      const filled = values.State === "Filled" || values.State === "Error";
      return (
        <Input
          size={SIZE[values.Size as FileSize]}
          aria-label="Headline"
          placeholder={texts[0]}
          value={filled ? texts[0] : ""}
          readOnly
          disabled={values.State === "Disabled"}
          aria-invalid={values.State === "Error" || undefined}
          data-demo-state={demo(values.State)}
        />
      );
    },
  },
  "Text Area": {
    fill: true,
    render: ({ values, texts }) => {
      const filled = values.State === "Filled" || values.State === "Error";
      return (
        <TextArea
          aria-label="Caption"
          placeholder={filled ? undefined : texts[0]}
          value={filled ? texts[0] : ""}
          readOnly
          disabled={values.State === "Disabled"}
          aria-invalid={values.State === "Error" || undefined}
          data-demo-state={demo(values.State)}
        />
      );
    },
  },
  Select: {
    fill: true,
    render: ({ values }) => (
      <Select
        size={SIZE[values.Size as FileSize]}
        ariaLabel="Variation"
        placeholder="Choose a variation"
        value={values.State === "Placeholder" ? undefined : "moss"}
        options={MOSS}
        onSelect={noop}
        disabled={values.State === "Disabled"}
        aria-invalid={values.State === "Error" || undefined}
        data-demo-state={demo(values.State)}
      />
    ),
  },
  Search: {
    fill: true,
    render: ({ values }) => (
      <Search
        label="Search templates"
        placeholder="Search templates"
        value={values.State === "Filled" ? "hiring" : ""}
        onChange={noop}
        data-demo-state={demo(values.State)}
      />
    ),
  },
  Field: {
    fill: true,
    render: ({ values, texts }) => (
      <Field label={texts[0]}>
        {values.Kind === "Text area" ? (
          <TextArea placeholder={texts[1]} readOnly />
        ) : values.Kind === "Upload" ? (
          <Upload placeholder={texts[1]} />
        ) : (
          <Input size="sm" placeholder={texts[1]} readOnly />
        )}
      </Field>
    ),
  },
  "Search Field": {
    fill: true,
    render: ({ values }) => (
      <SearchField
        open={values.State === "Open"}
        onOpenChange={noop}
        value={values.State === "Open" ? "hiring" : ""}
        onChange={noop}
        onClear={noop}
        label="Search templates"
        size={values.Size === "Medium" ? "md" : "lg"}
        focusOnOpen={false}
        data-demo-state={demo(values.State === "Open" ? undefined : values.State)}
      />
    ),
  },
  Switch: {
    render: ({ values }) => (
      <Switch
        checked={values.Checked === "On"}
        onChange={noop}
        ariaLabel="Allow photo uploads"
        disabled={values.State === "Disabled"}
        data-demo-state={demo(values.State)}
      />
    ),
  },
  Checkbox: {
    render: ({ values, texts }) => (
      <Checkbox
        checked={values.Checked === "Mixed" ? "mixed" : values.Checked === "On"}
        onChange={noop}
        label={texts[0]}
        disabled={values.State === "Disabled"}
        data-demo-state={demo(values.State)}
      />
    ),
  },
  Radio: {
    render: ({ values, texts }) => (
      <Radio
        checked={values.Checked === "On"}
        onChange={noop}
        label={texts[0]}
        disabled={values.State === "Disabled"}
        data-demo-state={demo(values.State)}
      />
    ),
  },
  Segment: {
    render: ({ values, texts }) => (
      <Segment
        selected={values.State === "Selected"}
        disabled={values.State === "Disabled"}
        data-demo-state={demo(values.State)}
      >
        {texts[0]}
      </Segment>
    ),
  },
  "Segmented Control": {
    render: () => (
      <SegmentedControl
        aria-label="Platform"
        options={PLATFORMS}
        selectedId="instagram"
        onSelect={noop}
      />
    ),
  },
  Stepper: {
    render: () => <Stepper label="Variations" value={1} min={1} max={4} onChange={noop} />,
  },
  Upload: {
    fill: true,
    render: ({ values }) =>
      values.Value === "Filled" ? (
        <Upload
          placeholder="Add a photo"
          thumbnail={photoPlaceholder}
          fileName="portrait.jpg"
          data-demo-state={demo(values.State)}
        />
      ) : (
        <Upload placeholder="Add a photo" data-demo-state={demo(values.State)} />
      ),
  },
  Badge: {
    render: ({ values, texts }) => (
      <Badge tone={values.Tone.toLowerCase() as BadgeTone}>{texts[0]}</Badge>
    ),
  },
  Tag: {
    render: ({ values, texts }) => (
      <Tag kind={values.Kind.toLowerCase() as TagKind}>{texts[0]}</Tag>
    ),
  },
  Chip: {
    render: ({ values, texts }) => (
      <Chip
        selected={values.State === "Selected" ? true : undefined}
        disabled={values.State === "Disabled"}
        data-demo-state={demo(values.State)}
      >
        {texts[0]}
      </Chip>
    ),
  },
  Avatar: {
    render: ({ values, texts }) => (
      <Avatar
        initials={texts[0]}
        size={SIZE[values.Size as FileSize]}
        shape={values.Shape === "Square" ? "square" : "circle"}
      />
    ),
  },
  "Nav Item": {
    fill: true,
    render: ({ values, texts }) => (
      <NavItem
        icon={Paintbrush}
        selected={values.State === "Selected"}
        disabled={values.State === "Disabled"}
        data-demo-state={demo(values.State)}
      >
        {texts[0]}
      </NavItem>
    ),
  },
  Breadcrumb: {
    render: ({ texts }) => (
      <Breadcrumb crumbs={[{ label: texts[0], onClick: noop }, { label: texts[1] }]} />
    ),
  },
  "Menu Item": {
    fill: true,
    render: ({ values, texts }) => (
      <MenuItemStatic
        icon={Copy}
        selected={values.State === "Selected"}
        disabled={values.State === "Disabled"}
        data-demo-state={demo(values.State)}
      >
        {texts[0]}
      </MenuItemStatic>
    ),
  },
  Menu: {
    fill: true,
    render: () => (
      <MenuPanel>
        <MenuLabelStatic>Template</MenuLabelStatic>
        <MenuItemStatic icon={Copy}>Duplicate</MenuItemStatic>
        <MenuItemStatic icon={Pencil} data-demo-state="hover">
          Rename
        </MenuItemStatic>
        <MenuItemStatic icon={Link}>Copy link</MenuItemStatic>
        <MenuDividerStatic />
        <MenuItemStatic icon={Trash2}>Delete</MenuItemStatic>
      </MenuPanel>
    ),
  },
  Tooltip: {
    render: ({ texts }) => <Tooltip label={texts[0]} value={texts[1]} />,
  },
  Toast: {
    render: ({ texts }) => <Toast message={texts[0]} actionLabel={texts[1]} onAction={noop} />,
  },
  Tab: {
    fill: true,
    // A tab shares the width of a row, so it is drawn in one.
    render: ({ values, texts }) => (
      <div className="dev-board__row">
        <Tab selected={values.State === "Selected"}>{texts[0]}</Tab>
      </div>
    ),
  },
  Tabs: {
    fill: true,
    render: () => (
      <Tabs
        aria-label="Inspector"
        items={[
          { id: "design", label: "Design" },
          { id: "field", label: "Field" },
        ]}
        selectedId="design"
        onSelect={noop}
      />
    ),
  },
  "Footer Links": {
    render: () => <FooterLinks />,
  },
  "Page Header": {
    fill: true,
    render: ({ values, texts }) =>
      values.Kind === "Breadcrumb" ? (
        <PageHeader
          crumbs={[{ label: texts[0], onClick: noop }, { label: texts[1] }]}
          status={texts[2]}
          actions={
            <Button kind="neutral" icon={Undo2}>
              {texts[3]}
            </Button>
          }
        />
      ) : (
        <PageHeader title={texts[0]} actions={<Button kind="neutral">{texts[1]}</Button>} />
      ),
  },
  Card: {
    fill: true,
    render: ({ values, texts }) =>
      values.State === "Loading" ? (
        <Card title={texts[0]} loading />
      ) : (
        <Card
          title={texts[0]}
          description={texts[2]}
          action={
            <Button kind="ghost" size="sm">
              {texts[1]}
            </Button>
          }
        />
      ),
  },
  Dialog: {
    render: ({ values, texts }) => (
      <ModalPanel title={texts[0]}>
        <ModalBody>{texts[1]}</ModalBody>
        <ModalActions>
          <Button kind="neutral">{texts[2]}</Button>
          <Button kind={values.Kind === "Destructive" ? "destructive" : "primary"}>
            {texts[3]}
          </Button>
        </ModalActions>
      </ModalPanel>
    ),
  },
  Metric: {
    fill: true,
    render: ({ values, texts }) =>
      values.State === "Loading" ? (
        <Metric label={texts[0]} value="" loading />
      ) : (
        <Metric
          label={texts[0]}
          value={texts[1]}
          delta={
            <Badge tone="positive" icon={ArrowUp}>
              {texts[2]}
            </Badge>
          }
          caption={texts[3]}
        />
      ),
  },
  "Table Row": {
    fill: true,
    render: ({ values, texts }) => (
      <Table aria-label="Public links">
        {values.State === "Loading" ? (
          <TableRow loading />
        ) : (
          <TableRow
            title={texts[0]}
            subtitle={texts[1]}
            action={copyAction}
            data-demo-state={demo(values.State)}
          >
            <TableCell quiet>{texts[2]}</TableCell>
            <TableCell>{texts[3]}</TableCell>
          </TableRow>
        )}
      </Table>
    ),
  },
  "Progress Bar": {
    fill: true,
    render: () => <ProgressBar value={0.6} label="Building the template" />,
  },
  "Progress Steps": {
    render: ({ values, texts }) => <Progress value={Number(values.Step) / 3} label={texts[0]} />,
  },
  Skeleton: {
    render: ({ values }) =>
      values.Shape === "Circle" ? (
        <Skeleton shape="circle" />
      ) : (
        <Skeleton shape={values.Shape === "Block" ? "block" : "line"} width={200} />
      ),
  },
  Alert: {
    fill: true,
    render: ({ values, texts }) => (
      <Alert tone={values.Tone.toLowerCase() as "neutral" | "error" | "warning"} title={texts[0]}>
        {texts[1]}
      </Alert>
    ),
  },
  "Empty State": {
    render: ({ texts }) => (
      <EmptyState
        icon={Paintbrush}
        title={texts[0]}
        action={
          <Button kind="primary" icon={Plus}>
            {texts[2]}
          </Button>
        }
      >
        {texts[1]}
      </EmptyState>
    ),
  },
};
