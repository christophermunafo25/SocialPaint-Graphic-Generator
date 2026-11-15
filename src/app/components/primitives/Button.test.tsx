import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChevronDown, Loader2 } from "lucide-react";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { Button, SendButton } from "./Button";

describe("Button", () => {
  it("is a type=button that runs its handler", async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Save</Button>);
    const button = screen.getByRole("button", { name: "Save" });
    expect(button).toHaveProperty("type", "button");
    await userEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("is Neutral at Medium unless told otherwise", () => {
    render(<Button>Save</Button>);
    const button = screen.getByRole("button", { name: "Save" });
    expect(button.dataset.kind).toBe("neutral");
    expect(button.dataset.size).toBe("md");
  });

  it("ignores clicks while disabled", async () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Save
      </Button>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onClick).not.toHaveBeenCalled();
  });

  it("passes native attributes and its ref through", () => {
    const ref = React.createRef<HTMLButtonElement>();
    render(
      <form id="f">
        <Button ref={ref} type="submit" form="f" aria-busy="true" kind="primary" size="lg">
          Publish
        </Button>
      </form>,
    );
    const button = screen.getByRole("button", { name: "Publish" });
    expect(ref.current).toBe(button);
    expect(button.getAttribute("type")).toBe("submit");
    expect(button.getAttribute("aria-busy")).toBe("true");
    expect(button.dataset.kind).toBe("primary");
    expect(button.dataset.size).toBe("lg");
  });

  it("draws its icons at 16 in every size, hidden from assistive tech", () => {
    const { container } = render(
      <Button icon={Loader2} trailingIcon={ChevronDown} size="sm" kind="ghost">
        Saving
      </Button>,
    );
    const svgs = [...container.querySelectorAll("svg")];
    expect(svgs).toHaveLength(2);
    for (const svg of svgs) {
      expect(svg.getAttribute("aria-hidden")).toBe("true");
      expect(svg.getAttribute("width")).toBe("16");
    }
    // The label sits between the leading and the trailing icon.
    const button = screen.getByRole("button", { name: "Saving" });
    expect([...button.children].map((c) => c.tagName.toLowerCase())).toEqual([
      "svg",
      "span",
      "svg",
    ]);
  });
});

describe("SendButton", () => {
  it("names itself from its label and shows its action", () => {
    render(
      <>
        <SendButton label="Send" />
        <SendButton label="Stop" action="stop" />
      </>,
    );
    expect(screen.getByRole("button", { name: "Send" }).dataset.action).toBe("send");
    expect(screen.getByRole("button", { name: "Stop" }).dataset.action).toBe("stop");
  });
});
