import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { Check, Ellipsis } from "lucide-react";

export interface RowMenuItem {
  label: string;
  onSelect(): void;
  disabled?: boolean;
  destructive?: boolean;
  /** Present (true OR false) renders the item as a menuitemradio with
   * `aria-checked` and a check mark on the current one — state never rides
   * on colour alone. Absent renders a plain menuitem. */
  checked?: boolean;
}

export interface RowMenuGroup {
  /** Mono group label above the items ("ROLE"). */
  label?: string;
  items: RowMenuItem[];
}

export interface RowMenuHandle {
  /** Open at a point — the row's contextmenu handler passes the pointer. */
  openAt(x: number, y: number): void;
}

interface RowMenuProps {
  groups: RowMenuGroup[];
  /** Names the trigger: "More actions for Montserrat". */
  ariaLabel: string;
}

const itemEls = (root: HTMLElement): HTMLButtonElement[] =>
  Array.from(root.querySelectorAll<HTMLButtonElement>(".sp-row-menu__item:not(:disabled)"));

/** The 32px "More actions" button for rows without a thumbnail (D9), and
 * its floating menu. The trigger appears on the row's hover and
 * focus-within (always visible where hover doesn't exist) — the row
 * carries `.sp-menu-row`. The menu takes arrow keys, Home/End, Escape
 * closes and returns focus to the trigger, and right-click on the row can
 * open the same menu through the imperative handle. FieldContextMenu was
 * considered and rejected: it has no menu roles, no keyboard navigation,
 * and no focus return. */
export const RowMenu = forwardRef<RowMenuHandle, RowMenuProps>(function RowMenu(
  { groups, ariaLabel },
  ref,
) {
  const [at, setAt] = useState<{ x: number; y: number } | null>(null);
  const open = at !== null;
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const close = useCallback((returnFocus: boolean) => {
    setAt(null);
    if (returnFocus) triggerRef.current?.focus();
  }, []);

  const openFromTrigger = () => {
    const r = triggerRef.current?.getBoundingClientRect();
    if (r) setAt({ x: r.right, y: r.bottom + 4 });
  };

  useImperativeHandle(ref, () => ({ openAt: (x, y) => setAt({ x, y }) }), []);

  // Outside pointer-down closes without stealing the focus return.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (menuRef.current?.contains(e.target as Node)) return;
      if (triggerRef.current?.contains(e.target as Node)) return;
      close(false);
    };
    window.addEventListener("pointerdown", onDown, true);
    return () => window.removeEventListener("pointerdown", onDown, true);
  }, [open, close]);

  // Clamp on-screen and focus the first enabled item once the menu exists.
  useLayoutEffect(() => {
    if (!at) return;
    const el = menuRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const left = Math.max(8, Math.min(at.x - r.width, window.innerWidth - r.width - 8));
    const top = Math.max(8, Math.min(at.y, window.innerHeight - r.height - 8));
    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
    itemEls(el)[0]?.focus();
  }, [at]);

  const onMenuKeyDown = (e: React.KeyboardEvent) => {
    const el = menuRef.current;
    if (!el) return;
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      close(true);
      return;
    }
    if (e.key === "Tab") {
      close(false);
      return;
    }
    const items = itemEls(el);
    if (!items.length) return;
    const i = items.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      items[(i + 1) % items.length]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      items[(i - 1 + items.length) % items.length]?.focus();
    } else if (e.key === "Home") {
      e.preventDefault();
      items[0]?.focus();
    } else if (e.key === "End") {
      e.preventDefault();
      items[items.length - 1]?.focus();
    }
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="sp-icon-btn sp-row-menu-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={ariaLabel}
        data-open={open || undefined}
        onClick={() => (open ? close(false) : openFromTrigger())}
      >
        <Ellipsis style={{ width: 16, height: 16 }} />
      </button>
      {at &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            aria-label={ariaLabel}
            className="sp-row-menu"
            style={{ left: at.x, top: at.y, maxHeight: Math.round(window.innerHeight * 0.7) }}
            onKeyDown={onMenuKeyDown}
            onContextMenu={(e) => e.preventDefault()}
          >
            {groups.map((g, gi) => (
              <React.Fragment key={gi}>
                {gi > 0 && <div className="sp-row-menu__divider" aria-hidden />}
                {g.label && <span className="sp-row-menu__group-label">{g.label}</span>}
                {g.items.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    role={item.checked !== undefined ? "menuitemradio" : "menuitem"}
                    aria-checked={item.checked}
                    disabled={item.disabled}
                    data-destructive={item.destructive || undefined}
                    className="sp-row-menu__item"
                    tabIndex={-1}
                    onMouseEnter={(e) => e.currentTarget.focus()}
                    onClick={() => {
                      close(true);
                      item.onSelect();
                    }}
                  >
                    {item.label}
                    {item.checked && <Check style={{ width: 13, height: 13 }} aria-hidden />}
                  </button>
                ))}
              </React.Fragment>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
});
