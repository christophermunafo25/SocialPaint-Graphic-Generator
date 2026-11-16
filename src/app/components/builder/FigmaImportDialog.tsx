import React, { useEffect, useRef, useState } from "react";
import { Frame } from "lucide-react";
import type { DesignImportResult } from "@/lib/types";
import { stores } from "@/lib/stores";
import { useAuth } from "@/lib/auth/AuthContext";
import { Button, Field, Input, Modal, ModalActions } from "../primitives";
import { NotConnected } from "./NotConnected";
import { useStillOpen } from "./useStillOpen";

interface FigmaImportDialogProps {
  onClose(): void;
  onImported(result: DesignImportResult): void | Promise<void>;
  /** Where focus goes when it closes (New template's opener). */
  returnFocus?: React.RefObject<HTMLElement | null>;
}

/** Import from Figma (329:3710): a 520 dialog with the frame link, then
 * Cancel and Import. The frame lands as the template's background with
 * every layer as a field. All Figma traffic goes through the Edge
 * Functions, so no token reaches the browser. Cancel while it imports
 * abandons the result. */
export function FigmaImportDialog({ onClose, onImported, returnFocus }: FigmaImportDialogProps) {
  const { company } = useAuth();
  const [connected, setConnected] = useState<boolean | null>(null);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const stillOpen = useStillOpen();

  useEffect(() => {
    if (!company) return;
    let cancelled = false;
    stores.designImport
      .isConnected(company.id)
      .then((c) => !cancelled && setConnected(c))
      .catch(() => !cancelled && setConnected(false));
    return () => {
      cancelled = true;
    };
  }, [company]);

  const runImport = async () => {
    if (!company || !url.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await stores.designImport.importFromUrl(company.id, url.trim());
      if (!stillOpen.current) return;
      await onImported(result);
    } catch (e) {
      if (stillOpen.current)
        setError(e instanceof Error ? e.message : "That frame didn't import. Try again.");
    } finally {
      if (stillOpen.current) setBusy(false);
    }
  };

  return (
    <Modal
      open
      onOpenChange={(next) => !next && onClose()}
      title="Import from Figma"
      icon={Frame}
      className="sp-tb-dialog"
      returnFocus={returnFocus}
      onOpenAutoFocus={(e) => {
        e.preventDefault();
        input.current?.focus();
      }}
    >
      {connected === false ? (
        <NotConnected service="Figma" onClose={onClose} />
      ) : (
        <form
          className="sp-tb-dialog__form"
          onSubmit={(e) => {
            e.preventDefault();
            void runImport();
          }}
        >
          <Field label="Frame link" error={error}>
            <Input
              ref={input}
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="figma.com/design/…"
              autoComplete="off"
              spellCheck={false}
              disabled={busy}
            />
          </Field>
          <ModalActions>
            <Button kind="neutral" onClick={onClose}>
              Cancel
            </Button>
            <Button
              kind="primary"
              type="submit"
              disabled={busy || connected === null || !url.trim()}
              aria-busy={busy || undefined}
            >
              {busy ? "Importing…" : "Import"}
            </Button>
          </ModalActions>
        </form>
      )}
    </Modal>
  );
}
