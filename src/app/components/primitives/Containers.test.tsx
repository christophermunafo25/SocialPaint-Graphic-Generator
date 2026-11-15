import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ArrowUp, Copy, Paintbrush, Plus } from "lucide-react";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { Alert } from "./Alert";
import { Button } from "./Button";
import { Badge } from "./Chips";
import {
  Card,
  Metric,
  ModalActions,
  ModalBody,
  ModalPanel,
  Progress,
  ProgressBar,
  Stat,
} from "./Containers";
import { EmptyState } from "./EmptyState";
import { Skeleton, SkeletonLines, SkeletonRows } from "./Skeleton";
import { Table, TableCell, TableRow } from "./TableRow";

describe("Card", () => {
  it("shows its title, description and action", () => {
    render(
      <Card
        title="Top templates"
        description="The five templates your team exported most."
        action={
          <Button kind="ghost" size="sm">
            View all
          </Button>
        }
      >
        <p>Rows</p>
      </Card>,
    );
    expect(screen.getByRole("heading", { name: "Top templates" })).toBeTruthy();
    expect(screen.getByText("The five templates your team exported most.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "View all" }).dataset.size).toBe("sm");
    expect(screen.getByText("Rows")).toBeTruthy();
  });

  it("loading is a busy region named by the title, with lines in place of its content", () => {
    const { container } = render(
      <Card title="Top templates" loading>
        <p>Rows</p>
      </Card>,
    );
    const card = screen.getByLabelText("Top templates");
    expect(card.getAttribute("aria-busy")).toBe("true");
    expect(container.querySelectorAll(".ui-skeleton").length).toBe(3);
    expect(screen.queryByText("Rows")).toBeNull();
    expect(screen.queryByRole("heading")).toBeNull();
  });
});

describe("Metric", () => {
  it("shows the label, the value and the change", () => {
    render(
      <Metric
        label="Exports"
        value="1,128"
        delta={
          <Badge tone="positive" icon={ArrowUp}>
            18%
          </Badge>
        }
        caption="vs previous 30 days"
      />,
    );
    expect(screen.getByText("Exports")).toBeTruthy();
    expect(screen.getByText("1,128").className).toContain("t-title-metric");
    expect(screen.getByText("18%")).toBeTruthy();
    expect(screen.getByText("vs previous 30 days")).toBeTruthy();
  });

  it("leaves out the change row when there is none", () => {
    const { container } = render(<Metric label="Exports" value="1,128" />);
    expect(container.querySelector(".ui-metric__change")).toBeNull();
  });

  it("loading keeps the card and shows three shapes", () => {
    const { container } = render(<Metric label="Exports" value="" loading />);
    expect(screen.getByLabelText("Exports").getAttribute("aria-busy")).toBe("true");
    expect(container.querySelectorAll(".ui-skeleton").length).toBe(3);
  });
});

describe("Stat", () => {
  it("is a label over its value, and a figure at Large", () => {
    const { container } = render(
      <>
        <Stat label="Admins" value="3" />
        <Stat size="lg" label="Opens" value="2,318" sub="286 via public links" />
      </>,
    );
    const [small, large] = Array.from(container.querySelectorAll<HTMLElement>(".ui-stat"));
    expect(small.dataset.size).toBeUndefined();
    expect(large.dataset.size).toBe("lg");
    expect(large.textContent).toBe("Opens2,318286 via public links");
  });
});

describe("A dialog's parts", () => {
  it("the panel holds the title, the close button, the body and the actions", () => {
    const { container } = render(
      <ModalPanel title="Delete this template?">
        <ModalBody>This cannot be undone.</ModalBody>
        <ModalActions>
          <Button kind="neutral">Cancel</Button>
          <Button kind="destructive">Delete template</Button>
        </ModalActions>
      </ModalPanel>,
    );
    expect(screen.getByText("Delete this template?").className).toContain("t-title-group");
    const close = screen.getByRole("button", { name: "Close" });
    // A ghost Small icon button, placed in the corner by the panel.
    expect(close.dataset.variant).toBe("ghost");
    expect(close.dataset.size).toBe("sm");
    expect(close.className).toContain("ui-modal__close");
    // A string body is one paragraph.
    expect(container.querySelector("p.ui-modal__body")?.textContent).toBe("This cannot be undone.");
    const actions = container.querySelector(".ui-modal__actions");
    expect(Array.from(actions?.querySelectorAll("button") ?? []).map((b) => b.textContent)).toEqual(
      ["Cancel", "Delete template"],
    );
  });

  it("a body of several parts is a block, and a wide panel says so", () => {
    const { container } = render(
      <ModalPanel title="Public links" wide>
        <ModalBody>
          <p>One</p>
          <p>Two</p>
        </ModalBody>
      </ModalPanel>,
    );
    expect(container.querySelector("div.ui-modal__body")?.children.length).toBe(2);
    expect(container.querySelector<HTMLElement>(".ui-modal")?.dataset.wide).toBe("true");
  });
});

describe("Progress", () => {
  it("draws a bar a step and fills the ones done", () => {
    const { container } = render(
      <>
        <p id="status">Writing your post</p>
        <Progress
          value={2 / 3}
          label="2 of 3 · Choosing a layout"
          steps={{ now: 2, max: 3, labelledBy: "status" }}
        />
      </>,
    );
    const bar = screen.getByRole("progressbar", { name: "Writing your post" });
    expect(bar.getAttribute("aria-valuenow")).toBe("2");
    expect(bar.getAttribute("aria-valuemax")).toBe("3");
    expect(bar.getAttribute("aria-valuetext")).toBe("2 of 3 · Choosing a layout");
    const bars = Array.from(container.querySelectorAll<HTMLElement>(".ui-progress__bar"));
    expect(bars.map((b) => b.dataset.done)).toEqual(["true", "true", undefined]);
    // The drawn label is not read twice.
    expect(screen.getByText("2 of 3 · Choosing a layout").getAttribute("aria-hidden")).toBe("true");
  });

  it("without steps, reads the share done of three", () => {
    const { container } = render(<Progress value={1 / 3} label="1 of 3 · Reading your brand" />);
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("33");
    const bars = Array.from(container.querySelectorAll<HTMLElement>(".ui-progress__bar"));
    expect(bars.map((b) => b.dataset.done)).toEqual(["true", undefined, undefined]);
  });

  it("ProgressBar without a value is indeterminate", () => {
    render(<ProgressBar label="Uploading" />);
    const bar = screen.getByRole("progressbar", { name: "Uploading" });
    expect(bar.hasAttribute("aria-valuenow")).toBe(false);
    expect(bar.dataset.indeterminate).toBe("true");
  });
});

describe("Table row", () => {
  const copy = (
    <Button kind="neutral" size="sm" icon={Copy}>
      Copy
    </Button>
  );

  it("is a row of cells inside its table", () => {
    render(
      <Table aria-label="Public links">
        <TableRow title="Newsletter readers" subtitle="Webinar invite" action={copy}>
          <TableCell quiet>58</TableCell>
          <TableCell>31</TableCell>
        </TableRow>
      </Table>,
    );
    expect(screen.getByRole("table", { name: "Public links" })).toBeTruthy();
    const row = screen.getByRole("row");
    expect(row.hasAttribute("tabindex")).toBe(false);
    const cells = screen.getAllByRole("cell");
    expect(cells.map((c) => c.textContent)).toEqual([
      "Newsletter readersWebinar invite",
      "58",
      "31",
      "Copy",
    ]);
    expect(cells[1].dataset.quiet).toBe("true");
    expect(cells[2].dataset.quiet).toBeUndefined();
  });

  it("with onClick takes focus and opens on a click, Enter and Space", async () => {
    const onOpen = vi.fn();
    const onCopy = vi.fn();
    render(
      <Table aria-label="Public links">
        <TableRow
          title="Newsletter readers"
          onClick={onOpen}
          action={
            <Button kind="neutral" size="sm" onClick={onCopy}>
              Copy
            </Button>
          }
        />
      </Table>,
    );
    const row = screen.getByRole("row");
    expect(row.getAttribute("tabindex")).toBe("0");
    await userEvent.click(screen.getByText("Newsletter readers"));
    expect(onOpen).toHaveBeenCalledTimes(1);
    row.focus();
    await userEvent.keyboard("{Enter}");
    await userEvent.keyboard(" ");
    expect(onOpen).toHaveBeenCalledTimes(3);
    // The action is its own control: it does not open the row.
    await userEvent.click(screen.getByRole("button", { name: "Copy" }));
    expect(onCopy).toHaveBeenCalledTimes(1);
    expect(onOpen).toHaveBeenCalledTimes(3);
    screen.getByRole("button", { name: "Copy" }).focus();
    await userEvent.keyboard("{Enter}");
    expect(onCopy).toHaveBeenCalledTimes(2);
    expect(onOpen).toHaveBeenCalledTimes(3);
  });

  it("loading shows the shape of each cell", () => {
    const { container } = render(
      <Table aria-label="Public links">
        <TableRow loading cells={3} />
        <TableRow loading action={false} />
      </Table>,
    );
    const [first, second] = Array.from(container.querySelectorAll(".ui-table-row"));
    // Two lines, three values and the action.
    expect(first.querySelectorAll(".ui-skeleton").length).toBe(6);
    // Two lines and two values.
    expect(second.querySelectorAll(".ui-skeleton").length).toBe(4);
  });
});

describe("Skeleton", () => {
  it("is decoration in one of three shapes", () => {
    const { container } = render(
      <>
        <Skeleton width={200} />
        <Skeleton shape="block" />
        <Skeleton shape="circle" width={26} />
        <Skeleton width={72} height={28} radius="sm" />
      </>,
    );
    const [line, block, circle, button] = Array.from(
      container.querySelectorAll<HTMLElement>(".ui-skeleton"),
    );
    expect(line.getAttribute("aria-hidden")).toBe("true");
    expect(line.dataset.shape).toBe("line");
    expect(line.style.width).toBe("200px");
    expect(block.dataset.shape).toBe("block");
    // A circle is as tall as it is wide.
    expect(circle.style.height).toBe("26px");
    expect(button.dataset.radius).toBe("sm");
  });

  it("with a label of its own is the busy region", () => {
    render(<Skeleton width={280} height={39} aria-busy="true" aria-label="Loading AI usage" />);
    const region = screen.getByLabelText("Loading AI usage");
    expect(region.hasAttribute("aria-hidden")).toBe(false);
    expect(region.getAttribute("aria-busy")).toBe("true");
  });

  it("lines and rows announce themselves once", () => {
    const { container } = render(
      <>
        <SkeletonLines lines={4} label="Loading preferences" />
        <SkeletonRows rows={2} label="Loading your team" />
      </>,
    );
    expect(
      screen.getByLabelText("Loading preferences").querySelectorAll(".ui-skeleton").length,
    ).toBe(4);
    const rows = screen.getByLabelText("Loading your team");
    expect(rows.getAttribute("aria-busy")).toBe("true");
    expect(rows.querySelectorAll(".ui-skeleton-row").length).toBe(2);
    expect(container.querySelectorAll('.ui-skeleton[data-shape="circle"]').length).toBe(2);
  });
});

describe("Alert", () => {
  it("an error is an alert, and the other tones are a status", () => {
    render(
      <>
        <Alert title="This template has unpublished changes">Publish to update it.</Alert>
        <Alert tone="warning" title="This public link expires in 3 days" />
        <Alert tone="error" title="We could not publish this template">
          Check your connection and try again.
        </Alert>
      </>,
    );
    const [neutral, warning] = screen.getAllByRole("status");
    expect(neutral.dataset.tone).toBe("neutral");
    expect(neutral.textContent).toBe("This template has unpublished changesPublish to update it.");
    expect(warning.dataset.tone).toBe("warning");
    const error = screen.getByRole("alert");
    expect(error.dataset.tone).toBe("error");
    expect(error.textContent).toContain("Check your connection and try again.");
  });
});

describe("Empty state", () => {
  it("shows a title, a line and one action under a decorative icon", () => {
    const { container } = render(
      <EmptyState
        icon={Paintbrush}
        title="No templates yet"
        action={
          <Button kind="primary" icon={Plus}>
            New template
          </Button>
        }
      >
        Build your first template.
      </EmptyState>,
    );
    expect(screen.getByText("No templates yet").className).toContain("t-title-card");
    expect(screen.getByText("Build your first template.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "New template" })).toBeTruthy();
    const tile = container.querySelector(".ui-empty__tile");
    expect(tile?.getAttribute("aria-hidden")).toBe("true");
    expect(tile?.querySelector("svg")?.getAttribute("width")).toBe("18");
  });
});
