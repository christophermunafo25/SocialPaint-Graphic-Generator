import React from "react";
import { ArrowUp, Copy, Download, Ellipsis, History, Link, Pencil, Trash2 } from "lucide-react";
import {
  Alert,
  Avatar,
  Badge,
  Button,
  Checkbox,
  Chip,
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
  PageHeader,
  Radio,
  SegmentedControl,
  Select,
  SendButton,
  Switch,
  Tabs,
  Tag,
  TextArea,
  Toast,
  Upload,
} from "@/app/components/primitives";

const noop = () => {};
const PLATFORMS = ["Instagram", "LinkedIn", "Facebook"].map((label) => ({
  id: label.toLowerCase(),
  label,
}));

/** What one panel of the Themes board (4012:1214) holds. Both panels draw
 * this; only the theme around it changes. The file's panel ends with the
 * Composer, a Product component, which this phase does not rebuild. Its
 * first Field shows help text, which the rules keep off. */
function PanelContent({ name }: { name: string }) {
  return (
    <>
      <h3 className="t-title-card">{name}</h3>
      <div className="dev-theme__row" data-align="center">
        <Button kind="primary">Publish</Button>
        <Button kind="neutral" icon={History}>
          History
        </Button>
        <Button kind="ghost">Cancel</Button>
        <Button kind="destructive">Delete</Button>
        <Button kind="primary" disabled>
          Publish
        </Button>
        <IconButton icon={Download} label="Download" />
        <IconButton variant="ghost" icon={Ellipsis} label="More actions" />
        <SendButton label="Send" />
      </div>
      <div className="dev-theme__row dev-theme__fields">
        <Field label="Headline">
          <Input size="sm" placeholder="Creative Director" readOnly />
        </Field>
        <Field label="Variation">
          <Select ariaLabel="Variation" value="moss" options={MOSS} onSelect={noop} />
        </Field>
        <Field label="Role" error="Add a role.">
          <Input value="Creative Director" readOnly />
        </Field>
        <Field label="Headline">
          <TextArea placeholder="Write a caption" readOnly />
        </Field>
        <Field label="Headline">
          <Upload placeholder="Add a photo" />
        </Field>
      </div>
      <div className="dev-theme__row" data-align="center">
        <Switch checked onChange={noop} ariaLabel="Allow photo uploads" />
        <Switch checked={false} onChange={noop} ariaLabel="Allow photo uploads" />
        <Checkbox checked onChange={noop} label="Allow photo uploads" />
        <Radio checked onChange={noop} label="Team fills in" />
        <SegmentedControl
          aria-label="Platform"
          options={PLATFORMS}
          selectedId="instagram"
          onSelect={noop}
        />
      </div>
      <div className="dev-theme__row" data-align="center">
        <Badge tone="positive">Published</Badge>
        <Badge tone="active">Active</Badge>
        <Badge tone="neutral">Draft</Badge>
        <Badge tone="error">Failed</Badge>
        <Badge tone="warning">Expiring</Badge>
        <Chip>Instagram</Chip>
        <Chip selected>LinkedIn</Chip>
        <Tag kind="outline">Missing</Tag>
        <Avatar initials="CM" />
      </div>
      <div className="dev-theme__row dev-theme__navigation" data-align="center">
        <div className="dev-theme__tabs">
          <Tabs
            aria-label="Inspector"
            items={[
              { id: "design", label: "Design" },
              { id: "field", label: "Field" },
            ]}
            selectedId="design"
            onSelect={noop}
          />
        </div>
        <FooterLinks />
        <PageHeader
          className="dev-theme__header"
          title="Insights & Analytics"
          actions={<Button kind="neutral">Export CSV</Button>}
        />
      </div>
      <div className="dev-theme__row">
        <MenuPanel className="dev-theme__menu">
          <MenuLabelStatic>Template</MenuLabelStatic>
          <MenuItemStatic icon={Copy}>Duplicate</MenuItemStatic>
          <MenuItemStatic icon={Pencil} data-demo-state="hover">
            Rename
          </MenuItemStatic>
          <MenuItemStatic icon={Link}>Copy link</MenuItemStatic>
          <MenuDividerStatic />
          <MenuItemStatic icon={Trash2}>Delete</MenuItemStatic>
        </MenuPanel>
        <Metric
          className="dev-theme__metric"
          label="Exports"
          value="1,128"
          delta={
            <Badge tone="positive" icon={ArrowUp}>
              18%
            </Badge>
          }
          caption="vs previous 30 days"
        />
      </div>
      <div className="dev-theme__row" data-align="center">
        <ModalPanel title="Delete this template?" wide>
          <ModalBody>
            Now hiring and its three variations will be removed for everyone on your team. Public
            links to it will stop working.
          </ModalBody>
          <ModalActions>
            <Button kind="neutral">Cancel</Button>
            <Button kind="destructive">Delete template</Button>
          </ModalActions>
        </ModalPanel>
      </div>
      <div className="dev-theme__row">
        <Alert className="dev-theme__alert" tone="error" title="We could not publish this template">
          Check your connection and try again. Your changes are saved.
        </Alert>
        <Toast message="Link copied" actionLabel="Undo" onAction={noop} />
      </div>
    </>
  );
}

const MOSS = [{ value: "moss", label: "Moss" }];

/** The Themes board's two panels, side by side: the same components in
 * Light and in Dark. */
export function ThemesPanels() {
  return (
    <div className="dev-theme">
      <div className="dev-theme__panel" data-theme="light">
        <PanelContent name="Light" />
      </div>
      <div className="dev-theme__panel" data-theme="dark">
        <PanelContent name="Dark" />
      </div>
    </div>
  );
}
