import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React, { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { Link } from "lucide-react";
import { Field, Input, TextArea, focusFirstInvalid } from "./Field";
import { Search } from "./Search";
import { SearchField } from "./SearchField";
import { Select } from "./Select";
import { Upload } from "./Upload";

describe("Field", () => {
  it("labels its control", () => {
    render(
      <Field label="Headline">
        <Input />
      </Field>,
    );
    expect(screen.getByLabelText("Headline").tagName).toBe("INPUT");
  });

  it("marks the control invalid and describes it by the error", () => {
    render(
      <Field label="Headline" error="Add a headline.">
        <Input aria-describedby="other" />
      </Field>,
    );
    const input = screen.getByLabelText("Headline");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    const ids = input.getAttribute("aria-describedby")!.split(" ");
    expect(ids).toContain("other");
    const message = document.getElementById(ids[1]);
    expect(message?.textContent).toBe("Add a headline.");
  });

  it("has no error and no describedby when the value is fine", () => {
    render(
      <Field label="Headline">
        <TextArea />
      </Field>,
    );
    const input = screen.getByLabelText("Headline");
    expect(input.hasAttribute("aria-invalid")).toBe(false);
    expect(input.hasAttribute("aria-describedby")).toBe(false);
  });
});

describe("focusFirstInvalid", () => {
  it("focuses the first invalid control in document order", () => {
    render(
      <form data-testid="form">
        <Field label="Name">
          <Input />
        </Field>
        <Field label="Headline" error="Add a headline.">
          <Input />
        </Field>
        <Field label="Website" error="Use a full address, like acme.com.">
          <Input />
        </Field>
      </form>,
    );
    const form = screen.getByTestId("form") as HTMLFormElement;
    expect(focusFirstInvalid(form)).toBe(true);
    expect(document.activeElement).toBe(screen.getByLabelText("Headline"));
  });

  it("reports when nothing is invalid", () => {
    render(<form data-testid="form" />);
    expect(focusFirstInvalid(screen.getByTestId("form") as HTMLFormElement)).toBe(false);
  });
});

describe("Input", () => {
  it("is Medium unless told otherwise", () => {
    render(
      <>
        <Input aria-label="Name" />
        <Input aria-label="City" size="sm" />
        <Input aria-label="Email" size="lg" />
      </>,
    );
    expect(screen.getByLabelText("Name").dataset.size).toBe("md");
    expect(screen.getByLabelText("City").dataset.size).toBe("sm");
    expect(screen.getByLabelText("Email").dataset.size).toBe("lg");
  });

  it("with an icon, sits in a box and still takes its ref and attributes", () => {
    const ref = React.createRef<HTMLInputElement>();
    const { container } = render(
      <Field label="Link" error="Use a full address.">
        <Input ref={ref} icon={Link} className="mine" placeholder="acme.com" />
      </Field>,
    );
    const input = screen.getByLabelText("Link");
    expect(ref.current).toBe(input);
    expect(input.tagName).toBe("INPUT");
    expect(input.getAttribute("placeholder")).toBe("acme.com");
    // The Field's invalid mark lands on the input, which the box reads.
    expect(input.getAttribute("aria-invalid")).toBe("true");
    const box = container.querySelector(".ui-input--box") as HTMLElement;
    expect(box.contains(input)).toBe(true);
    expect(box.classList.contains("mine")).toBe(true);
    // The box is a label, so a click on its icon or padding reaches the
    // input, and it adds nothing to the input's name.
    expect(box.tagName).toBe("LABEL");
    expect(box.textContent).toBe("");
    expect(box.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
  });
});

describe("Select in a Field", () => {
  it("takes the Field's invalid mark and its message", () => {
    render(
      <Field label="Role" error="Pick a role.">
        <Select ariaLabel="Role" value={undefined} options={[]} onSelect={() => {}} />
      </Field>,
    );
    const trigger = screen.getByRole("combobox", { name: "Role" });
    expect(trigger.getAttribute("aria-invalid")).toBe("true");
    const message = document.getElementById(trigger.getAttribute("aria-describedby")!);
    expect(message?.textContent).toBe("Pick a role.");
  });
});

describe("Search", () => {
  function Controlled({ onClear }: { onClear?: () => void }) {
    const [value, setValue] = useState("");
    return <Search label="Search fonts" value={value} onChange={setValue} onClear={onClear} />;
  }

  it("is a search box that is always open, with a clear button while it holds a query", async () => {
    render(<Controlled />);
    const input = screen.getByRole("searchbox", { name: "Search fonts" });
    expect(screen.queryByRole("button", { name: "Clear search" })).toBeNull();
    await userEvent.type(input, "inter");
    expect((input as HTMLInputElement).value).toBe("inter");
    await userEvent.click(screen.getByRole("button", { name: "Clear search" }));
    expect((input as HTMLInputElement).value).toBe("");
    // Clearing keeps the keyboard in the field.
    expect(document.activeElement).toBe(input);
  });

  it("hands clearing to the caller when it asks", async () => {
    const onClear = vi.fn();
    render(<Controlled onClear={onClear} />);
    await userEvent.type(screen.getByRole("searchbox"), "inter");
    await userEvent.click(screen.getByRole("button", { name: "Clear search" }));
    expect(onClear).toHaveBeenCalledTimes(1);
  });
});

describe("SearchField", () => {
  function Controlled({ onClear = () => {} }: { onClear?: () => void }) {
    const [open, setOpen] = useState(false);
    const [value, setValue] = useState("");
    return (
      <SearchField
        open={open}
        onOpenChange={setOpen}
        value={value}
        onChange={setValue}
        onClear={() => {
          setValue("");
          onClear();
        }}
        label="Search templates"
      />
    );
  }

  it("opens into a focused field, clears, and collapses on Escape", async () => {
    const onClear = vi.fn();
    render(<Controlled onClear={onClear} />);
    await userEvent.click(screen.getByRole("button", { name: "Search templates" }));
    const input = screen.getByRole("searchbox", { name: "Search templates" });
    expect(document.activeElement).toBe(input);
    await userEvent.type(input, "hiring");
    await userEvent.click(screen.getByRole("button", { name: "Clear search" }));
    expect(onClear).toHaveBeenCalled();
    expect(document.activeElement).toBe(screen.getByRole("searchbox"));
    await userEvent.keyboard("{Escape}");
    expect(screen.getByRole("button", { name: "Search templates" })).toBeTruthy();
  });
});

describe("Field markers", () => {
  it("draws Edited, Optional and an action on the label row", async () => {
    const onCopy = vi.fn();
    render(
      <Field label="Caption" edited optional action={{ label: "Copy", onClick: onCopy }}>
        <TextArea />
      </Field>,
    );
    expect(screen.getByText("Edited")).toBeTruthy();
    expect(screen.getByText("Optional")).toBeTruthy();
    // The markers are not part of the control's name.
    expect(screen.getByLabelText("Caption").tagName).toBe("TEXTAREA");
    await userEvent.click(screen.getByRole("button", { name: "Copy" }));
    expect(onCopy).toHaveBeenCalled();
  });
});

describe("Upload", () => {
  it("is one button, empty or filled", async () => {
    const onClick = vi.fn();
    const { rerender } = render(<Upload placeholder="Add a photo" onClick={onClick} />);
    await userEvent.click(screen.getByRole("button", { name: "Add a photo" }));
    expect(onClick).toHaveBeenCalled();
    rerender(<Upload placeholder="Add a photo" thumbnail="data:," fileName="portrait.jpg" />);
    expect(screen.getByRole("button").textContent).toBe("portrait.jpgReplace");
  });

  it("takes a dropped file", () => {
    const onDropFile = vi.fn();
    render(<Upload placeholder="Add a photo" onDropFile={onDropFile} />);
    const file = new File(["x"], "portrait.jpg", { type: "image/jpeg" });
    const drop = new Event("drop", { bubbles: true, cancelable: true });
    Object.defineProperty(drop, "dataTransfer", { value: { files: [file], types: ["Files"] } });
    screen.getByRole("button").dispatchEvent(drop);
    expect(onDropFile).toHaveBeenCalledWith(file);
  });
});

describe("TextArea copy", () => {
  it("draws a Small Ghost copy button inside the box, and Field still labels the text", async () => {
    const onCopy = vi.fn();
    const { container, rerender } = render(
      <Field label="Caption">
        <TextArea defaultValue="Hello" copy={{ label: "Copy caption", onCopy }} />
      </Field>,
    );
    const area = screen.getByLabelText("Caption");
    expect(area.tagName.toLowerCase()).toBe("textarea");
    const button = screen.getByRole("button", { name: "Copy caption" });
    expect(button.getAttribute("data-variant")).toBe("ghost");
    expect(button.getAttribute("data-size")).toBe("sm");
    await userEvent.click(button);
    expect(onCopy).toHaveBeenCalledTimes(1);
    rerender(
      <Field label="Caption">
        <TextArea defaultValue="Hello" copy={{ label: "Copy caption", onCopy, copied: true }} />
      </Field>,
    );
    expect(container.querySelector(".ui-icon-slot__check")).not.toBeNull();
  });
});
