import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Loader2 } from "lucide-react";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { AttachButton, Button, SendButton } from "./Button";

describe("Button", () => {
  it("is a type=button that runs its handler", async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Save</Button>);
    const button = screen.getByRole("button", { name: "Save" });
    expect(button).toHaveProperty("type", "button");
    await userEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
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

  it("draws its icon hidden from assistive tech, sized to the button", () => {
    const { container } = render(
      <Button icon={Loader2} size="sm">
        Saving
      </Button>,
    );
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("aria-hidden")).toBe("true");
    expect(svg?.getAttribute("width")).toBe("14");
  });
});

describe("SendButton and AttachButton", () => {
  it("name themselves from their label", () => {
    render(
      <>
        <SendButton label="Send" />
        <SendButton label="Stop" action="stop" />
        <AttachButton label="Attach" aria-haspopup="menu" aria-expanded={false} />
      </>,
    );
    expect(screen.getByRole("button", { name: "Send" }).dataset.action).toBe("send");
    expect(screen.getByRole("button", { name: "Stop" }).dataset.action).toBe("stop");
    expect(screen.getByRole("button", { name: "Attach" }).getAttribute("aria-expanded")).toBe(
      "false",
    );
  });
});
