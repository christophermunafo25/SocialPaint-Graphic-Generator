import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, FileSpreadsheet, Download } from "lucide-react";
import type { FieldValues, TemplateSchema } from "@/lib/types";
import { stores } from "@/lib/stores";
import { useAsync } from "@/lib/useAsync";
import { useAuth } from "@/lib/auth/AuthContext";
import { useBrand } from "@/lib/brand/BrandContext";
import { useFileDrop } from "@/lib/useFileDrop";
import { createCanvasMeasurer } from "@/lib/render/autoFit";
import { parseCsv, type ParsedCsv } from "@/lib/bulk/csv";
import { autoMap, fillableFields, starterCsv, type ColumnMap } from "@/lib/bulk/mapping";
import { checkRows, type RowCheck } from "@/lib/bulk/validate";
import { MAX_BULK_ROWS, runBulk, slugify, type BulkRunResult } from "@/lib/bulk/run";
import { overCapLine, readyLine, rowStatus } from "@/lib/bulk/copy";
import { useRouter } from "../../router";
import { ErrorState } from "../ErrorState";
import { Page, PageHeader } from "../layout/Page";
import { Select } from "../ui/Select";
import { Switch } from "../Switch";
import { TemplateThumbnail } from "../TemplateThumbnail";
import { BulkExportStage, type BulkExportStageHandle } from "./BulkExportStage";

// Bulk fill: one published template, one spreadsheet, one graphic per row.
//
// Four states in one column and nothing else: a person doing this has one
// file and wants one answer, so there is no wizard chrome. The page holds
// every piece of run state itself and drops it on unmount — there is no
// draft to persist, and nothing here writes to the schema or the store
// except the usage batch after a run.
//
// The two properties that make this safe live elsewhere and are only used
// here: rasterization goes through the one path every export takes
// (BulkExportStage → renderSchemaBlob), and a row whose text would overflow
// is refused by default (checkRows) rather than exported with text hanging
// off the canvas.

type Step = "upload" | "mapping" | "review" | "running" | "done";

/** A CSV bigger than this is not a spreadsheet of graphics. Parsing it
 * would freeze the tab before the row cap could refuse it. */
const MAX_CSV_BYTES = 5 * 1024 * 1024;

const IGNORE = "__ignore__";

/** Hand a Blob to the person as a download. Same anchor technique and the
 * same 60-second revoke as the single export, for the same iOS reason. */
function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.download = fileName;
  link.href = url;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

const labelText: React.CSSProperties = {
  fontSize: "var(--type-label-size)",
  color: "var(--text-secondary)",
};
const mutedText: React.CSSProperties = {
  fontSize: "var(--type-label-size)",
  color: "var(--text-muted)",
};
const mono: React.CSSProperties = { fontFamily: "var(--font-mono)" };

export function BulkFillPage({ templateId }: { templateId: string }) {
  const { kit } = useBrand();
  const { navigate } = useRouter();
  const templateState = useAsync(() => stores.templates.get(templateId), [templateId]);
  const template = templateState.status === "ready" ? templateState.data : null;

  if (templateState.status === "loading") {
    return (
      <p className="text-center py-24" style={mutedText}>
        Loading template…
      </p>
    );
  }
  if (templateState.status === "error") {
    return (
      <ErrorState
        title="We couldn't load this template."
        detail="Check your connection and try again."
        onRetry={templateState.retry}
      />
    );
  }
  if (!template) {
    return (
      <p className="text-center py-24" style={mutedText}>
        Template not found.
      </p>
    );
  }
  if (template.status !== "published") {
    return (
      <Page>
        <BackLink onClick={() => navigate({ name: "template", templateId })} />
        <p className="text-center py-24" style={mutedText}>
          Publish this template before filling it in bulk.
        </p>
      </Page>
    );
  }
  return <BulkFill template={template} kit={kit} />;
}

function BackLink({ onClick }: { onClick(): void }) {
  return (
    <button onClick={onClick} className="flex items-center gap-1.5 mb-5" style={labelText}>
      <ArrowLeft style={{ width: 14, height: 14 }} />
      Back to the template
    </button>
  );
}

function BulkFill({
  template,
  kit,
}: {
  template: TemplateSchema;
  kit: ReturnType<typeof useBrand>["kit"];
}) {
  const { navigate } = useRouter();
  const { user } = useAuth();
  const fields = useMemo(() => fillableFields(template), [template]);

  const [step, setStep] = useState<Step>("upload");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [csv, setCsv] = useState<ParsedCsv | null>(null);
  const [map, setMap] = useState<ColumnMap>([]);
  const [checks, setChecks] = useState<RowCheck[]>([]);
  const [includeProblems, setIncludeProblems] = useState(false);
  const [problemsOnly, setProblemsOnly] = useState(false);
  const [selectedRow, setSelectedRow] = useState(0);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [outcome, setOutcome] = useState<{
    result: BulkRunResult;
    attempted: number;
    skipped: number;
    canceled: boolean;
    zipName: string;
  } | null>(null);

  const stageRef = useRef<BulkExportStageHandle>(null);
  const abortRef = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    setStep("upload");
    setUploadError(null);
    setFileName("");
    setCsv(null);
    setMap([]);
    setChecks([]);
    setIncludeProblems(false);
    setProblemsOnly(false);
    setSelectedRow(0);
    setOutcome(null);
  }, []);

  // ── Upload ────────────────────────────────────────────────────────────
  const onFile = useCallback(
    async (file: File) => {
      setUploadError(null);
      if (file.size > MAX_CSV_BYTES) {
        setUploadError(
          "That file is over 5MB. A spreadsheet of graphics is far smaller than that.",
        );
        return;
      }
      try {
        const parsed = parseCsv(await file.text());
        setFileName(file.name);
        setCsv(parsed);
        setMap(autoMap(parsed.headers, fields));
        setStep("mapping");
      } catch (e) {
        setUploadError(e instanceof Error ? e.message : "We couldn't read that file.");
      }
    },
    [fields],
  );

  const downloadStarter = useCallback(() => {
    downloadBlob(
      new Blob([starterCsv(template)], { type: "text/csv" }),
      `${slugify(template.name) || "template"}-starter.csv`,
    );
  }, [template]);

  // ── Mapping ───────────────────────────────────────────────────────────
  const requiredUnmapped = useMemo(
    () => fields.filter((f) => f.required && !map.includes(f.fieldKey)),
    [fields, map],
  );
  const mappedCount = map.filter((m) => m !== null).length;

  const setColumn = (column: number, fieldKey: string) => {
    setMap((prev) =>
      prev.map((current, i) => {
        if (i === column) return fieldKey === IGNORE ? null : fieldKey;
        // A field fills from one column: choosing it here releases it there.
        return current === fieldKey ? null : current;
      }),
    );
  };

  const review = useCallback(async () => {
    if (!csv) return;
    // Measure with the glyphs the stage will paint with, not the fallback
    // face a still-loading webfont leaves behind.
    await document.fonts?.ready;
    setChecks(checkRows(template, kit, csv.rows, map, createCanvasMeasurer()));
    setSelectedRow(0);
    setStep("review");
  }, [csv, map, template, kit]);

  // ── Review ────────────────────────────────────────────────────────────
  const readyCount = checks.filter((c) => c.ok).length;
  const overCap = checks.length > MAX_BULK_ROWS;
  const toRender = useMemo(
    () => (includeProblems ? checks : checks.filter((c) => c.ok)),
    [checks, includeProblems],
  );
  const visibleChecks = problemsOnly ? checks.filter((c) => !c.ok) : checks;
  const firstMappedColumn = map.findIndex((m) => m !== null);
  const identifierField = fields.find((f) => f.fieldKey === map[firstMappedColumn]);
  const previewValues: FieldValues | undefined = checks[selectedRow]?.values;

  const run = useCallback(async () => {
    const stage = stageRef.current;
    if (!stage || toRender.length === 0) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setProgress({ done: 0, total: toRender.length });
    setStep("running");
    const result = await runBulk({
      schema: template,
      checks: toRender,
      render: (values) => stage.renderRow(values),
      onProgress: (done, total) => setProgress({ done, total }),
      signal: controller.signal,
    });
    const zipName = `${slugify(template.name) || "graphics"}-bulk.zip`;
    if (result.rendered > 0) {
      downloadBlob(result.zip, zipName);
      // One bulk_export event per graphic that actually rendered, in one
      // write. A stopped run records what it produced. Never a download:
      // see the note on UsageAction.
      void stores.usage.recordBulk(template.companyId, template.id, result.rendered, user?.id);
    }
    setOutcome({
      result,
      attempted: toRender.length,
      skipped: checks.length - toRender.length,
      canceled: controller.signal.aborted,
      zipName,
    });
    abortRef.current = null;
    setStep("done");
  }, [toRender, template, checks.length, user?.id]);

  // Leaving the page mid-run stops the loop at the next row boundary.
  useEffect(() => () => abortRef.current?.abort(), []);

  return (
    <Page>
      <BackLink onClick={() => navigate({ name: "template", templateId: template.id })} />
      <PageHeader
        eyebrow="Bulk fill"
        title={template.name}
        description="One spreadsheet in, one graphic per row out, every one exported exactly as a single fill would be."
      />

      {/* The off-screen canvas is mounted for the whole visit, so the
          background and fonts are resolved once, before the first row. */}
      <BulkExportStage ref={stageRef} schema={template} brandKit={kit} />

      {step === "upload" && (
        <UploadStep
          fields={fields.map((f) => f.label)}
          hasImageSlots={template.fields.some((f) => f.type === "image" && !f.static)}
          error={uploadError}
          onFile={(f) => void onFile(f)}
          onStarter={downloadStarter}
        />
      )}

      {step === "mapping" && csv && (
        <div className="sp-card p-5 space-y-4">
          <div className="space-y-1">
            <h2 className="sp-panel-title">Match columns to fields</h2>
            <p style={mutedText}>
              Read {csv.rows.length} {csv.rows.length === 1 ? "row" : "rows"} and{" "}
              {csv.headers.length} {csv.headers.length === 1 ? "column" : "columns"} from {fileName}{" "}
              ({delimiterName(csv.delimiter)}-separated). Each column can fill one field; columns
              you do not need can be ignored.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full" style={{ fontSize: "var(--type-label-size)", minWidth: 560 }}>
              <thead>
                <tr className="text-left" style={{ borderBottom: "1px solid var(--border)" }}>
                  {["Column", "First row", "Fills"].map((h) => (
                    <th key={h} className="sp-eyebrow px-3 py-2" style={{ fontWeight: 400 }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {csv.headers.map((header, i) => (
                  <tr key={i} style={{ borderTop: "1px solid var(--border)" }}>
                    <td className="px-3 py-2" style={{ color: "var(--text-primary)" }}>
                      {header || <span style={mutedText}>(no heading)</span>}
                    </td>
                    <td
                      className="px-3 py-2"
                      style={{
                        ...mono,
                        fontSize: "var(--type-caption-size)",
                        color: "var(--text-secondary)",
                      }}
                    >
                      {truncate(csv.rows[0]?.[i] ?? "", 48)}
                    </td>
                    <td className="px-3 py-2" style={{ width: 240 }}>
                      <Select
                        id={`bulk-map-${i}`}
                        ariaLabel={`Field for column ${header || i + 1}`}
                        value={map[i] ?? IGNORE}
                        options={[
                          { value: IGNORE, label: "Ignore" },
                          ...fields.map((f) => ({
                            value: f.fieldKey,
                            label: f.required ? `${f.label} (required)` : f.label,
                          })),
                        ]}
                        onSelect={(v) => setColumn(i, v)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {requiredUnmapped.length > 0 && (
            <p role="status" style={labelText}>
              {requiredUnmapped.length === 1
                ? `${requiredUnmapped[0].label} is required and has no column yet. Map a column to it before continuing.`
                : `${requiredUnmapped.map((f) => f.label).join(", ")} are required and have no column yet. Map a column to each before continuing.`}
            </p>
          )}
          {requiredUnmapped.length === 0 && mappedCount === 0 && (
            <p role="status" style={labelText}>
              No column is mapped yet. Choose a field for at least one column.
            </p>
          )}

          <div className="flex items-center justify-between gap-3">
            <button className="sp-btn sp-btn-ghost" onClick={reset}>
              Choose a different file
            </button>
            <button
              className="sp-btn sp-btn-primary"
              disabled={requiredUnmapped.length > 0 || mappedCount === 0}
              onClick={() => void review()}
            >
              Check rows
            </button>
          </div>
        </div>
      )}

      {step === "review" && csv && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="sp-card p-5 space-y-4 lg:col-span-7">
            <div className="space-y-1">
              <h2 className="sp-panel-title">{readyLine(readyCount, checks.length)}</h2>
              {overCap ? (
                <p role="status" style={labelText}>
                  {overCapLine(checks.length, MAX_BULK_ROWS)}
                </p>
              ) : (
                <p style={mutedText}>
                  {readyCount === checks.length
                    ? "Every row fits its template. Export when you are ready."
                    : "Rows with problems are left out of the export unless you include them below. Hover a row to preview it."}
                </p>
              )}
            </div>

            {readyCount < checks.length && (
              <div className="space-y-3">
                <Switch
                  checked={problemsOnly}
                  onChange={setProblemsOnly}
                  label={<span style={labelText}>Show only rows with problems</span>}
                />
                <label className="flex items-start gap-2" style={labelText}>
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={includeProblems}
                    onChange={(e) => setIncludeProblems(e.target.checked)}
                  />
                  <span>
                    Include rows with problems anyway. They export as they are: text that overflows
                    runs past the edge of the graphic, and an empty required field shows the field's
                    placeholder.
                  </span>
                </label>
              </div>
            )}

            <div className="overflow-x-auto">
              <table
                className="w-full"
                style={{ fontSize: "var(--type-label-size)", minWidth: 480 }}
              >
                <thead>
                  <tr className="text-left" style={{ borderBottom: "1px solid var(--border)" }}>
                    {["Row", identifierField?.label ?? "Value", "Status"].map((h) => (
                      <th key={h} className="sp-eyebrow px-3 py-2" style={{ fontWeight: 400 }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visibleChecks.map((c) => {
                    const selected = c.index === selectedRow;
                    return (
                      <tr
                        key={c.index}
                        onMouseEnter={() => setSelectedRow(c.index)}
                        onFocus={() => setSelectedRow(c.index)}
                        onClick={() => setSelectedRow(c.index)}
                        tabIndex={0}
                        aria-selected={selected}
                        style={{
                          borderTop: "1px solid var(--border)",
                          background: selected ? "var(--bg-hover)" : undefined,
                          cursor: "default",
                        }}
                      >
                        <td
                          className="px-3 py-2"
                          style={{
                            ...mono,
                            fontSize: "var(--type-caption-size)",
                            color: "var(--text-secondary)",
                          }}
                        >
                          {c.index + 1}
                        </td>
                        <td className="px-3 py-2" style={{ color: "var(--text-primary)" }}>
                          {truncate(
                            identifierField ? (c.values[identifierField.fieldKey] ?? "") : "",
                            40,
                          )}
                        </td>
                        <td
                          className="px-3 py-2"
                          style={{ color: c.ok ? "var(--text-secondary)" : "var(--text-primary)" }}
                        >
                          {rowStatus(c.problems)}
                        </td>
                      </tr>
                    );
                  })}
                  {visibleChecks.length === 0 && (
                    <tr>
                      <td className="px-3 py-3" colSpan={3} style={mutedText}>
                        No rows have problems.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between gap-3">
              <button className="sp-btn sp-btn-ghost" onClick={() => setStep("mapping")}>
                Back to columns
              </button>
              <button
                className="sp-btn sp-btn-primary"
                disabled={overCap || toRender.length === 0}
                onClick={() => void run()}
              >
                <Download style={{ width: 14, height: 14 }} />
                Export {toRender.length} {toRender.length === 1 ? "graphic" : "graphics"}
              </button>
            </div>
          </div>

          <div className="lg:col-span-5 lg:sticky lg:top-8">
            <PreviewCard template={template} values={previewValues} row={selectedRow} />
          </div>
        </div>
      )}

      {step === "running" && (
        <div className="sp-card p-5 space-y-4">
          <h2 className="sp-panel-title">
            Rendering {Math.min(progress.done + 1, progress.total)} of {progress.total}
          </h2>
          <div
            aria-hidden
            style={{
              height: 4,
              borderRadius: "var(--radius-pill)",
              background: "var(--bg-hover)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%`,
                background: "var(--state-primary)",
                transition: "width var(--dur-state) var(--ease)",
              }}
            />
          </div>
          <p style={mutedText}>
            Each graphic goes through the same export as a single download. Stopping keeps
            everything rendered so far.
          </p>
          <button className="sp-btn sp-btn-ghost" onClick={() => abortRef.current?.abort()}>
            Stop after this row
          </button>
        </div>
      )}

      {step === "done" && outcome && (
        <div className="sp-card p-5 space-y-4">
          <h2 className="sp-panel-title">
            {outcome.result.rendered === 0
              ? "Nothing rendered."
              : `${outcome.result.rendered} ${outcome.result.rendered === 1 ? "graphic" : "graphics"} rendered and downloaded as ${outcome.zipName}.`}
          </h2>
          <div className="space-y-1" style={labelText}>
            {outcome.canceled && (
              <p>
                Stopped after {outcome.result.rendered + outcome.result.failed.length} of{" "}
                {outcome.attempted}. The rows that rendered are in the ZIP.
              </p>
            )}
            {outcome.skipped > 0 && (
              <p>
                {outcome.skipped} {outcome.skipped === 1 ? "row was" : "rows were"} skipped because
                of problems in the review step.
              </p>
            )}
            {outcome.result.rendered > 0 && (
              <p>captions.csv inside the ZIP lists the caption for every graphic by row.</p>
            )}
            {outcome.result.failed.map((f) => (
              <p key={f.index}>
                Row {f.index + 1} did not render: {f.message}
              </p>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <button className="sp-btn sp-btn-primary" onClick={reset}>
              Start over
            </button>
            <button
              className="sp-btn sp-btn-ghost"
              onClick={() => navigate({ name: "template", templateId: template.id })}
            >
              Back to the template
            </button>
          </div>
        </div>
      )}
    </Page>
  );
}

function UploadStep({
  fields,
  hasImageSlots,
  error,
  onFile,
  onStarter,
}: {
  fields: string[];
  hasImageSlots: boolean;
  error: string | null;
  onFile(file: File): void;
  onStarter(): void;
}) {
  const drop = useFileDrop((files) => {
    if (files[0]) onFile(files[0]);
  });
  return (
    <div className="sp-card p-5 space-y-4">
      <label
        {...drop.bind}
        data-active={drop.active}
        className="sp-dropzone flex flex-col items-center justify-center gap-2 cursor-pointer text-center"
        style={{
          minHeight: 160,
          padding: "var(--space-md)",
          border: "1.5px dashed var(--border-strong)",
          borderRadius: "var(--radius-control)",
          color: "var(--text-secondary)",
          fontSize: "var(--type-label-size)",
        }}
      >
        <span className="sp-dropzone__icon flex">
          <FileSpreadsheet style={{ width: 22, height: 22 }} />
        </span>
        <span style={{ color: "var(--text-primary)" }}>
          Drop a CSV here, or click to choose one
        </span>
        <span style={mutedText}>One row per graphic. Comma, tab, or semicolon separated.</span>
        <input
          type="file"
          accept=".csv,.tsv,text/csv,text/tab-separated-values"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
            e.target.value = "";
          }}
        />
      </label>

      {error && (
        <p role="alert" style={labelText}>
          {error}
        </p>
      )}

      <div className="space-y-2" style={mutedText}>
        <p>
          The first line is the column headings. Headings that match a field name are mapped
          automatically ({fields.join(", ")}); anything else you match by hand on the next step.
          Rows whose text does not fit the template are left out of the export unless you choose to
          include them.
        </p>
        {hasImageSlots && (
          <p>
            Image slots are not filled from a CSV. They render as the template designed them: the
            fixed artwork where there is one, and the placeholder where there is not.
          </p>
        )}
      </div>

      <button className="sp-btn sp-btn-ghost" onClick={onStarter}>
        <Download style={{ width: 14, height: 14 }} />
        Download a starter CSV
      </button>
    </div>
  );
}

function PreviewCard({
  template,
  values,
  row,
}: {
  template: TemplateSchema;
  values: FieldValues | undefined;
  row: number;
}) {
  return (
    <div className="sp-card p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="sp-panel-title">Row {row + 1}</h3>
        <span className="sp-eyebrow">
          {template.canvasWidth}×{template.canvasHeight} · live
        </span>
      </div>
      <div
        className="overflow-hidden"
        style={{
          background: "var(--bg-hover)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-media-inner)",
          aspectRatio: `${template.canvasWidth} / ${template.canvasHeight}`,
          maxWidth: `calc((100vh - 180px) * ${template.canvasWidth / template.canvasHeight})`,
          marginInline: "auto",
        }}
      >
        <TemplateThumbnail template={template} values={values} />
      </div>
    </div>
  );
}

const delimiterName = (d: ParsedCsv["delimiter"]) =>
  d === "\t" ? "tab" : d === ";" ? "semicolon" : "comma";

const truncate = (text: string, max: number) =>
  text.length > max ? `${text.slice(0, max - 1)}…` : text;
