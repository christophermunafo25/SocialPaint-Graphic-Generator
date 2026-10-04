import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

// Proves the happy-dom project runs React, testing-library and user-event
// before any primitive exists.
describe("dom project", () => {
  it("renders a button and clicks it", async () => {
    const onClick = vi.fn();
    render(<button onClick={onClick}>Save</button>);
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
