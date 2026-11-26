import { act, fireEvent, render, screen } from "@testing-library/react";
import { Check, Copy, Search } from "lucide-react";
import React, { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Button } from "./Button";
import { IconButton } from "./IconButton";
import { BUSY_DELAY_MS, CONFIRM_MS } from "./motion";
import { Toast } from "./Overlays";
import { SearchField } from "./SearchField";
import { Checkbox, SegmentedControl } from "./Toggles";
import { Upload } from "./Upload";

const root = document.documentElement;

describe("CONFIRM_MS", () => {
  it("is the one hold every confirmation uses", () => {
    expect(CONFIRM_MS).toBe(1500);
    expect(BUSY_DELAY_MS).toBe(400);
  });
});

describe("the icon slot", () => {
  afterEach(() => {
    delete root.dataset.input;
  });

  it("crossfades a change the pointer made, then drops the old glyph", () => {
    vi.useFakeTimers();
    root.dataset.input = "pointer";
    const { container, rerender } = render(<Button icon={Copy}>Copy caption</Button>);
    const slot = container.querySelector(".ui-icon-slot")!;
    expect(slot.hasAttribute("data-animate")).toBe(false);
    rerender(<Button icon={Check}>Copy caption</Button>);
    expect(slot.hasAttribute("data-animate")).toBe(true);
    expect(slot.querySelectorAll(".ui-icon-slot__g")).toHaveLength(2);
    expect(slot.querySelector("[data-leaving]")).not.toBeNull();
    // The check is the drawn mark.
    expect(slot.querySelector(".ui-icon-slot__check path")?.getAttribute("pathLength")).toBe("1");
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(slot.querySelectorAll(".ui-icon-slot__g")).toHaveLength(1);
    vi.useRealTimers();
  });

  it("lands the new glyph at once from the keyboard", () => {
    root.dataset.input = "keyboard";
    const { container, rerender } = render(<Button icon={Copy}>Copy caption</Button>);
    rerender(<Button icon={Check}>Copy caption</Button>);
    const slot = container.querySelector(".ui-icon-slot")!;
    expect(slot.hasAttribute("data-animate")).toBe(false);
    expect(slot.querySelectorAll(".ui-icon-slot__g")).toHaveLength(1);
  });
});

describe("busy", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("marks the button busy, ignores clicks and spins only past 400 ms", () => {
    const onClick = vi.fn();
    const { container } = render(
      <Button icon={Copy} busy onClick={onClick}>
        Download
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Download" });
    expect(button.getAttribute("aria-busy")).toBe("true");
    expect(button.getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
    expect(container.querySelector(".ui-icon-slot__spinner")).toBeNull();
    act(() => {
      vi.advanceTimersByTime(BUSY_DELAY_MS);
    });
    expect(container.querySelector(".ui-icon-slot__spinner")).not.toBeNull();
  });

  it("does the same for an Icon Button", () => {
    const { container } = render(<IconButton icon={Copy} label="Copy" busy />);
    const button = screen.getByRole("button", { name: "Copy" });
    expect(button.getAttribute("aria-busy")).toBe("true");
    act(() => {
      vi.advanceTimersByTime(BUSY_DELAY_MS);
    });
    expect(container.querySelector(".ui-icon-slot__spinner")).not.toBeNull();
  });
});

describe("Icon Button Outline", () => {
  it("is its own variant", () => {
    render(<IconButton icon={Search} label="Collapse sidebar" variant="outline" />);
    expect(
      screen.getByRole("button", { name: "Collapse sidebar" }).getAttribute("data-variant"),
    ).toBe("outline");
  });
});

describe("Search Field sizes", () => {
  it("is Medium unless told otherwise, and clears with a real Icon Button", () => {
    const onClear = vi.fn();
    const { rerender } = render(
      <SearchField
        open={false}
        onOpenChange={() => {}}
        value=""
        onChange={() => {}}
        onClear={onClear}
        label="Search templates"
      />,
    );
    expect(screen.getByRole("button", { name: "Search templates" }).getAttribute("data-size")).toBe(
      "md",
    );
    rerender(
      <SearchField
        open
        size="lg"
        onOpenChange={() => {}}
        value="hiring"
        onChange={() => {}}
        onClear={onClear}
        label="Search templates"
      />,
    );
    const clear = screen.getByRole("button", { name: "Clear search" });
    expect(clear.classList.contains("ui-iconbtn")).toBe(true);
    expect(clear.getAttribute("data-variant")).toBe("ghost");
    fireEvent.click(clear);
    expect(onClear).toHaveBeenCalledTimes(1);
  });
});

describe("Checkbox mark", () => {
  it("keeps both paths in the box and shows one by state", () => {
    function Box() {
      const [on, setOn] = useState<boolean | "mixed">(false);
      return (
        <>
          <Checkbox checked={on} onChange={setOn} label="Logo" />
          <button type="button" onClick={() => setOn("mixed")}>
            Mix
          </button>
        </>
      );
    }
    const { container } = render(<Box />);
    const box = container.querySelector(".ui-check__box")!;
    expect(box.querySelectorAll("path")).toHaveLength(2);
    expect(box.hasAttribute("data-on")).toBe(false);
    fireEvent.click(screen.getByRole("checkbox", { name: "Logo" }));
    expect(box.getAttribute("data-on")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Mix" }));
    expect(box.getAttribute("data-on")).toBe("mixed");
  });
});

describe("Toast", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("times out on its own duration and waits while the pointer is on it", () => {
    const onTimeout = vi.fn();
    render(<Toast message="Color changed" duration={5000} onTimeout={onTimeout} />);
    const toast = screen.getByRole("status");
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    fireEvent.pointerEnter(toast);
    act(() => {
      vi.advanceTimersByTime(10000);
    });
    expect(onTimeout).not.toHaveBeenCalled();
    fireEvent.pointerLeave(toast);
    act(() => {
      vi.advanceTimersByTime(1999);
    });
    expect(onTimeout).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(onTimeout).toHaveBeenCalledTimes(1);
  });

  it("eases out before it unmounts, and keeps what it said", () => {
    const { rerender } = render(<Toast open message="Saved" />);
    rerender(<Toast open={false} message={undefined} />);
    const toast = screen.getByRole("status");
    expect(toast.hasAttribute("data-leaving")).toBe(true);
    expect(toast.textContent).toBe("Saved");
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("forgets a pointer hold when it closes, so the next message still times out", () => {
    const onTimeout = vi.fn();
    const { rerender } = render(
      <Toast open message="Color changed" duration={5000} onTimeout={onTimeout} />,
    );
    fireEvent.pointerEnter(screen.getByRole("status"));
    rerender(<Toast open={false} message="Color changed" duration={5000} onTimeout={onTimeout} />);
    act(() => {
      vi.advanceTimersByTime(500);
    });
    rerender(<Toast open message="Logo changed" duration={5000} onTimeout={onTimeout} />);
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(onTimeout).toHaveBeenCalledTimes(1);
  });

  it("turns back when it opens again while leaving", () => {
    const { rerender } = render(<Toast open message="Saved" />);
    rerender(<Toast open={false} message="Saved" />);
    rerender(<Toast open message="Saved again" />);
    const toast = screen.getByRole("status");
    expect(toast.hasAttribute("data-leaving")).toBe(false);
    expect(toast.textContent).toBe("Saved again");
  });
});

describe("Upload", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("pulses its tile only once an upload passes 400 ms", () => {
    const { container } = render(<Upload placeholder="Add a photo" busy />);
    const button = screen.getByRole("button");
    expect(button.getAttribute("aria-busy")).toBe("true");
    expect(container.querySelector(".ui-upload__pulse")).toBeNull();
    act(() => {
      vi.advanceTimersByTime(BUSY_DELAY_MS);
    });
    expect(container.querySelector(".ui-upload__pulse")).not.toBeNull();
  });

  it("shows a photo that is there at first paint at once", () => {
    const { container } = render(<Upload placeholder="Add a photo" thumbnail="a.jpg" />);
    expect(container.querySelector(".ui-upload__thumb")?.hasAttribute("data-pending")).toBe(false);
  });

  it("holds a new photo back until it has loaded", () => {
    const { container, rerender } = render(<Upload placeholder="Add a photo" />);
    rerender(<Upload placeholder="Add a photo" thumbnail="b.jpg" fileName="b.jpg" />);
    expect(container.querySelector(".ui-upload__thumb")?.hasAttribute("data-pending")).toBe(true);
  });
});

describe("the liquid selection", () => {
  afterEach(() => {
    delete root.dataset.input;
  });
  const options = [
    { id: "a", label: "Layers" },
    { id: "b", label: "Form" },
  ];
  function Control() {
    const [id, setId] = useState("a");
    return (
      <SegmentedControl options={options} selectedId={id} onSelect={setId} aria-label="View" />
    );
  }

  it("renders the thumb and the liquid out of the accessibility tree, once placed", () => {
    const { container } = render(<Control />);
    const track = container.querySelector(".ui-segmented")!;
    expect(track.hasAttribute("data-liquid")).toBe(true);
    expect(track.querySelector(".ui-segmented__thumb")?.getAttribute("aria-hidden")).toBe("true");
    expect(track.querySelector(".ui-segmented__goo")?.getAttribute("aria-hidden")).toBe("true");
    expect(document.getElementById("sp-goo")).not.toBeNull();
    expect(screen.getAllByRole("radio")).toHaveLength(2);
  });

  it("places the thumb at once for a keyboard selection", () => {
    root.dataset.input = "keyboard";
    const { container } = render(<Control />);
    const track = container.querySelector<HTMLElement>(".ui-segmented")!;
    fireEvent.keyDown(screen.getByRole("radio", { name: "Layers" }), { key: "ArrowRight" });
    expect(screen.getByRole("radio", { name: "Form" }).getAttribute("aria-checked")).toBe("true");
    expect(track.style.getPropertyValue("--_drop-s")).toBe("0");
  });

  it("sends the drop after a pointer click", () => {
    root.dataset.input = "pointer";
    const { container } = render(<Control />);
    const track = container.querySelector<HTMLElement>(".ui-segmented")!;
    fireEvent.click(screen.getByRole("radio", { name: "Form" }), { detail: 1 });
    expect(track.style.getPropertyValue("--_drop-s")).toBe("1");
  });
});
