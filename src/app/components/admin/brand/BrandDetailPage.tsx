import React, { useState } from "react";
import { ArrowLeft, Check } from "lucide-react";
import { useRouter } from "../../../router";
import { Page, PageHeader } from "../../layout/Page";
import { ConfirmDialog } from "../../ConfirmDialog";
import { useUnsavedChangesWarning } from "@/lib/useUnsavedChangesWarning";
import type { Impact } from "./kitPlumbing";

interface BrandDetailPageProps {
  title: string;
  description: string;
  /** Working copy differs from the saved kit. Drives the unload warning and
   * the discard confirmation on the way back to the overview. */
  dirty: boolean;
  saving: boolean;
  saved: boolean;
  saveLabel: string;
  error: string | null;
  onSave(): void;
  children: React.ReactNode;
}

/** The scaffold every Brand Studio category detail shares: one category at
 * a time, its own save button, a back link that never silently drops work
 * (dirty state asks before discarding), and the reload/close warning. */
export function BrandDetailPage({
  title,
  description,
  dirty,
  saving,
  saved,
  saveLabel,
  error,
  onSave,
  children,
}: BrandDetailPageProps) {
  const { navigate } = useRouter();
  const [confirmLeave, setConfirmLeave] = useState(false);
  useUnsavedChangesWarning(dirty);

  const goBack = () => {
    if (dirty) setConfirmLeave(true);
    else navigate({ name: "brandStudio" });
  };

  return (
    <Page>
      <button
        onClick={goBack}
        className="flex items-center gap-1.5 mb-5"
        style={{ fontSize: "var(--type-label-size)", color: "var(--text-secondary)" }}
      >
        <ArrowLeft style={{ width: 14, height: 14 }} />
        Brand Studio
      </button>

      <PageHeader
        title={title}
        description={description}
        action={
          <button onClick={onSave} disabled={saving || !dirty} className="sp-btn sp-btn-primary">
            {saved ? <Check className="w-4 h-4" /> : null}
            {saved ? "Saved" : saving ? "Saving…" : saveLabel}
          </button>
        }
      />

      <ConfirmDialog
        open={confirmLeave}
        title="Discard unsaved changes?"
        tone="danger"
        description="This category has edits that haven't been saved. Leaving now throws them away."
        confirmLabel="Discard changes"
        onCancel={() => setConfirmLeave(false)}
        onConfirm={() => {
          setConfirmLeave(false);
          navigate({ name: "brandStudio" });
        }}
      />

      {error && (
        <p
          className="mb-5 text-sm px-4 py-3"
          data-radius-card
          style={{ background: "var(--danger-wash)", color: "var(--destructive)" }}
        >
          {error}
        </p>
      )}

      {children}
    </Page>
  );
}

/** The shared "this restyles bound fields" confirmation for palette and
 * type-style saves — the two edits that still propagate through the one
 * live brand channel. */
export function ImpactDialog({
  impact,
  onCancel,
  onConfirm,
}: {
  impact: Impact | null;
  onCancel(): void;
  onConfirm(): void;
}) {
  return (
    <ConfirmDialog
      open={impact !== null}
      title="Apply brand changes?"
      tone="primary"
      description={
        impact && (
          <>
            This restyles {impact.fields} field{impact.fields === 1 ? "" : "s"} across{" "}
            {impact.templateNames.length} template{impact.templateNames.length === 1 ? "" : "s"}{" "}
            through bound type styles.
            {impact.templateNames.length <= 10 && (
              <span className="block mt-2">{impact.templateNames.join(" · ")}</span>
            )}
            {impact.removals && (
              <span className="block mt-2">
                Removed styles and colors release their fields back to each field's own settings.
              </span>
            )}
          </>
        )
      }
      confirmLabel="Apply changes"
      onCancel={onCancel}
      onConfirm={onConfirm}
    />
  );
}
