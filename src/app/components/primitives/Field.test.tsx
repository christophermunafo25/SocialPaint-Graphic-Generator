import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React, { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { Field, Input, TextArea, focusFirstInvalid } from "./Field";
import { Filter } from "./Filter";
import { SearchField } from "./SearchField";

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

describe("Filter", () => {
  it("is a button that passes its menu state through", async () => {
    const onClick = vi.fn();
    render(
      <Filter aria-haspopup="menu" aria-expanded={false} onClick={onClick}>
        Last 30 days
      </Filter>,
    );
    const button = screen.getByRole("button", { name: "Last 30 days" });
    await userEvent.click(button);
    expect(onClick).toHaveBeenCalled();
    expect(button.getAttribute("aria-haspopup")).toBe("menu");
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
