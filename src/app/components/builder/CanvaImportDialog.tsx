import React, { useEffect, useRef, useState } from "react";
import { Paintbrush } from "lucide-react";
import type { AutoBuildResult, DesignImportResult } from "@/lib/types";
import { stores } from "@/lib/stores";
import { useAuth } from "@/lib/auth/AuthContext";
import { Button, Field, Input, Modal, ModalActions } from "../primitives";
import { BuildProgress, useBuildStage } from "./AutoBuildDialog";
import { NotConnected } from "./NotConnected";
import { useStillOpen } from "./useStillOpen";

interface CanvaImportDialogProps {
  onClose(): void;
  onBuilt(result: AutoBuildResult | DesignImportResult): void | Promise<void>;
  /** Where focus goes when it closes (New template's opener). */
  returnFocus?: React.RefObject<HTMLElement | null>;
}

/** Import from Canva: Import from Figma's dialog (329:3710) for a Canva
 * design link. Canva shares a flat export rather than layers, so this runs
 * the auto build: Claude proposes the fields from the picture, and while it
 * works the dialog shows Auto build's steps (329:4286). */
export function CanvaImportDialog({ onClose, onBuilt, returnFocus }: CanvaImportDialogProps) {
  const { company } = useAuth();
  const [status, setStatus] = useState<{ enabled: boolean; connected: boolean } | null>(null);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const stage = useBuildStage(busy);
  const stillOpen = useStillOpen();
  const input = useRef<HTMLInputElement>(null);

  // A failed import brings the form back with the error under the link;
  // focus goes there, so the error is read with it.
  useEffect(() => {
    if (error) input.current?.focus();
  }, [error]);

  useEffect(() => {
    if (!company) return;
    let cancelled = false;
    stores.designImport
      .canvaStatus(company.id)
      .then((s) => !cancelled && setStatus(s))
      .catch(() => !cancelled && setStatus({ enabled: false, connected: false }));
    return () => {
      cancelled = true;
    };
  }, [company]);

  const run = async () => {
    if (!company || !url.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await stores.designImport.autoBuild(company.id, {
        kind: "canva",
        url: url.trim(),
      });
      if (!stillOpen.current) return;
      await onBuilt(result);
    } catch (e) {
      if (stillOpen.current)
        setError(e instanceof Error ? e.message : "That design didn't import. Try again.");
    } finally {
      if (stillOpen.current) setBusy(false);
    }
  };

  return (
    <Modal
      open
      onOpenChange={(next) => !next && onClose()}
      title="Import from Canva"
      icon={Paintbrush}
      className="sp-tb-dialog"
      returnFocus={returnFocus}
      onOpenAutoFocus={(e) => {
        e.preventDefault();
        input.current?.focus();
      }}
    >
      {busy ? (
        <BuildProgress stage={stage} onCancel={onClose} />
      ) : status !== null && !(status.enabled && status.connected) ? (
        <NotConnected service="Canva" onClose={onClose} />
      ) : (
        <form
          className="sp-tb-dialog__form"
          onSubmit={(e) => {
            e.preventDefault();
            void run();
          }}
        >
          <Field label="Design link" error={error}>
            <Input
              ref={input}
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="canva.com/design/…"
              autoComplete="off"
              spellCheck={false}
            />
          </Field>
          <ModalActions>
            <Button kind="neutral" onClick={onClose}>
              Cancel
            </Button>
            <Button kind="primary" type="submit" disabled={status === null || !url.trim()}>
              Import
            </Button>
          </ModalActions>
        </form>
      )}
    </Modal>
  );
}
