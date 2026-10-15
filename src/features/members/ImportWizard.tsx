"use client";

import Link from "next/link";
import { useRef, useState, type DragEvent } from "react";
import { ArrowLeft, ArrowRight, Check, CheckCircle2, Download, FileSpreadsheet, FileUp, NotebookText, TriangleAlert } from "lucide-react";
import {
  commitImport,
  guessMapping,
  IMPORT_FIELDS,
  lastImportJob,
  mappingProblem,
  reviewImport,
  useDb,
  type DuplicateChoice,
  type ImportMapping,
  type ImportReview,
  type ReviewRow,
} from "@/data/repo";
import { canAccess } from "@/lib/access";
import { cn, plural } from "@/lib/cn";
import { downloadCsv } from "@/lib/csv";
import { fmtDate } from "@/lib/dates";
import { formatPhone } from "@/lib/phone";
import { ROLES } from "@/lib/roles";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Select } from "@/components/ui/Field";
import { toast } from "@/components/ui/Toast";
import { useChurch } from "@/components/shell/ChurchContext";
import { NoAccess } from "@/components/shell/NoAccess";
import { churchHref } from "@/components/shell/nav";
import { useGuideMark } from "@/components/shell/hooks";

type Step = 1 | 2 | 3 | 4;
const STEPS = ["Upload", "Map columns", "Review", "Confirm"];
const SAMPLE = "members_notebook.csv";

interface Parsed {
  fileName: string;
  headers: string[];
  rows: Record<string, string>[];
}

async function parseCsv(text: string, fileName: string): Promise<Parsed> {
  // Loaded on demand: the parser is only needed on this screen.
  const Papa = (await import("papaparse")).default;
  const result = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true, transformHeader: (h) => h.trim() });
  const headers = (result.meta.fields ?? []).filter(Boolean);
  return { fileName, headers, rows: result.data };
}

function Stepper({ step }: { step: Step }) {
  return (
    <ol className="flex flex-wrap gap-1.5" aria-label="Import steps">
      {STEPS.map((label, i) => {
        const n = (i + 1) as Step;
        const done = n < step;
        const current = n === step;
        return (
          <li
            key={label}
            aria-current={current ? "step" : undefined}
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold",
              current ? "bg-navy text-white" : done ? "bg-teal-soft text-teal-ink" : "bg-navy-50 text-muted",
            )}
          >
            {n} {label}
            {done && <Check className="size-3.5" aria-label="done" />}
          </li>
        );
      })}
    </ol>
  );
}

export function ImportWizard() {
  const db = useDb();
  const { church, role, persona } = useChurch();
  const mark = useGuideMark();
  const [step, setStep] = useState<Step>(1);
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [mapping, setMapping] = useState<ImportMapping | null>(null);
  const [review, setReview] = useState<ImportReview | null>(null);
  const [choices, setChoices] = useState<Record<number, DuplicateChoice>>({});
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [done, setDone] = useState<{ added: number; merged: number; skipped: number } | null>(null);

  if (!(role === "pastor" || role === "secretary") || !canAccess(role, "members")) {
    return <NoAccess body={`${ROLES[role].label}: ${ROLES[role].limits} Importing members is for the Pastor and Secretary.`} primary={{ href: churchHref(church.slug, "members"), label: "Back to members" }} />;
  }

  const load = async (text: string, fileName: string) => {
    setProblem(null);
    const p = await parseCsv(text, fileName);
    if (!p.headers.length || !p.rows.length) {
      setProblem("That file has no rows we can read. Check it has a header row with column names.");
      return;
    }
    setParsed(p);
    setMapping(guessMapping(p.headers));
    setStep(2);
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    if (/\.(xlsx?|ods)$/i.test(file.name)) {
      setProblem("Excel files are read in the full version. In Excel or Google Sheets, choose File > Download > CSV, then upload that file.");
      return;
    }
    if (file.size > 2_000_000) {
      setProblem("That file is larger than 2 MB. Split it into smaller files and import them one at a time.");
      return;
    }
    setBusy(true);
    try {
      await load(await file.text(), file.name);
    } finally {
      setBusy(false);
    }
  };

  const useSample = async () => {
    setBusy(true);
    try {
      const res = await fetch("/samples/members_notebook.csv");
      if (!res.ok) throw new Error();
      await load(await res.text(), SAMPLE);
    } catch {
      setProblem("The sample file couldn't be loaded. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  const toReview = () => {
    if (!parsed || !mapping) return;
    setReview(reviewImport(db, church.id, parsed.rows, mapping));
    setChoices({});
    setStep(3);
  };

  const confirm = () => {
    if (!review || !parsed) return;
    const result = commitImport(church.id, review, choices, parsed.fileName, persona.display);
    if (parsed.fileName === SAMPLE) mark("import_sample");
    setDone(result);
    toast(`${plural(result.added, "member")} imported`, { body: result.merged ? `${result.merged} merged into existing members.` : undefined });
  };

  const reset = () => {
    setStep(1);
    setParsed(null);
    setMapping(null);
    setReview(null);
    setChoices({});
    setDone(null);
  };

  const last = lastImportJob(db, church.id);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-5">
      <div>
        <Link href={churchHref(church.slug, "members")} className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-navy hover:underline">
          <ArrowLeft className="size-4" aria-hidden /> Members
        </Link>
        <h1 className="text-3xl font-extrabold">Import members</h1>
        <p className="mt-1 max-w-2xl text-muted">Bring in the members list from a notebook or spreadsheet. Nothing is saved until you confirm.</p>
      </div>

      {done ? (
        <Card className="flex flex-col items-center px-6 py-12 text-center">
          <CheckCircle2 className="size-10 text-teal-ink" aria-hidden />
          <h2 className="mt-3 text-2xl font-bold">{plural(done.added, "member")} added</h2>
          <p className="mt-2 max-w-md text-muted">
            {done.merged > 0 && `${done.merged} merged into existing members. `}
            {done.skipped > 0 && `${done.skipped} skipped. `}
            Imported members show as New until their first check-in.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <ButtonLink href={`${churchHref(church.slug, "members")}?status=new`}>View new members</ButtonLink>
            <Button variant="secondary" onClick={reset}>
              Import another file
            </Button>
          </div>
        </Card>
      ) : (
        <Card>
          <div className="flex flex-col gap-3 border-b border-line p-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h2 className="text-[17px] font-bold">
                {step === 1 ? "Choose a file" : step === 2 ? "Match your columns" : step === 3 ? `Import review · ${parsed?.fileName}` : "Confirm import"}
              </h2>
              {parsed && step >= 3 && review && (
                <p className="mt-1 text-sm text-muted">
                  {plural(review.rows.length, "row")} · uploaded by {persona.display} today · nothing is saved until you confirm
                </p>
              )}
            </div>
            <Stepper step={step} />
          </div>

          {step === 1 && (
            <UploadStep busy={busy} problem={problem} onFile={onFile} onSample={useSample} last={last ? `Last import: ${last.file_name}, ${plural(last.added, "member")} added by ${last.imported_by} on ${fmtDate(last.created_at, "d MMM")}.` : null} />
          )}
          {step === 2 && parsed && mapping && (
            <MapStep parsed={parsed} mapping={mapping} onChange={setMapping} onBack={() => setStep(1)} onNext={toReview} />
          )}
          {step === 3 && review && (
            <ReviewStep review={review} choices={choices} setChoices={setChoices} fileName={parsed!.fileName} onBack={() => setStep(2)} onNext={() => setStep(4)} />
          )}
          {step === 4 && review && <ConfirmStep review={review} choices={choices} onBack={() => setStep(3)} onConfirm={confirm} />}
        </Card>
      )}
    </div>
  );
}

function UploadStep({
  busy,
  problem,
  onFile,
  onSample,
  last,
}: {
  busy: boolean;
  problem: string | null;
  onFile: (f: File | undefined) => void;
  onSample: () => void;
  last: string | null;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    onFile(e.dataTransfer.files?.[0]);
  };
  return (
    <div className="grid gap-4 p-5 lg:grid-cols-2">
      <div className="flex flex-col rounded-2xl bg-gold-soft p-5">
        <NotebookText className="size-6 text-gold-ink" aria-hidden />
        <h3 className="mt-3 text-lg font-bold">No file? Use our sample</h3>
        <p className="mt-1 text-sm text-ink">
          A typical church notebook typed into a spreadsheet: mixed phone formats, blank lines, a few duplicates and some rows that need fixing.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button onClick={onSample} disabled={busy} icon={<FileSpreadsheet className="size-4" aria-hidden />}>
            Use sample notebook file
          </Button>
          <a href="/samples/members_notebook.csv" download className="text-sm font-semibold text-navy underline underline-offset-4">
            Download it to look
          </a>
        </div>
      </div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
        className={cn("flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-6 text-center transition-colors", over ? "border-teal bg-teal-soft" : "border-line-strong")}
      >
        <FileUp className="size-7 text-navy-600" aria-hidden />
        <p className="mt-2 font-semibold text-navy">Upload your own CSV</p>
        <p className="mt-1 text-sm text-muted">Drag a file here, or choose one. Needs a header row with column names.</p>
        <input ref={input} type="file" accept=".csv,text/csv,.xlsx,.xls" className="sr-only" id="import-file" onChange={(e) => onFile(e.target.files?.[0])} />
        <label htmlFor="import-file" className="mt-4 inline-flex h-11 cursor-pointer items-center gap-2 rounded-xl border border-line-strong bg-white px-4 text-sm font-semibold text-navy hover:bg-navy-50">
          Choose file
        </label>
      </div>
      {problem && (
        <p role="alert" className="flex items-start gap-2 rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger-ink lg:col-span-2">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          {problem}
        </p>
      )}
      {last && <p className="text-sm text-muted lg:col-span-2">{last}</p>}
    </div>
  );
}

function MapStep({
  parsed,
  mapping,
  onChange,
  onBack,
  onNext,
}: {
  parsed: Parsed;
  mapping: ImportMapping;
  onChange: (m: ImportMapping) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const problem = mappingProblem(mapping);
  const samples = (h: string | null) =>
    h
      ? parsed.rows
          .map((r) => (r[h] ?? "").trim())
          .filter(Boolean)
          .slice(0, 3)
      : [];
  return (
    <div className="p-5">
      <p className="text-sm text-muted">
        We read <span className="font-semibold text-navy">{plural(parsed.rows.length, "row")}</span> and {plural(parsed.headers.length, "column")} from{" "}
        <span className="font-semibold text-navy">{parsed.fileName}</span>, and guessed which column is which. Check them below.
      </p>
      <ul className="mt-4 divide-y divide-line rounded-2xl border border-line">
        {IMPORT_FIELDS.map((f) => (
          <li key={f.key} className="grid gap-2 p-4 sm:grid-cols-[12rem_14rem_1fr] sm:items-center">
            <div>
              <label htmlFor={`map-${f.key}`} className="font-semibold text-navy">
                {f.label}
              </label>
              <p className="text-xs text-muted">{f.hint}</p>
            </div>
            <Select
              id={`map-${f.key}`}
              value={mapping[f.key] ?? ""}
              onChange={(e) => onChange({ ...mapping, [f.key]: e.target.value || null })}
            >
              <option value="">Not in this file</option>
              {parsed.headers.map((h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
            </Select>
            <p className="truncate text-sm text-muted">{samples(mapping[f.key]).join(" · ") || "No values"}</p>
          </li>
        ))}
      </ul>
      {problem && (
        <p role="alert" className="mt-4 rounded-xl bg-gold-soft px-4 py-3 text-sm text-gold-ink">
          {problem}
        </p>
      )}
      <div className="mt-5 flex justify-between gap-2">
        <Button variant="secondary" onClick={onBack} icon={<ArrowLeft className="size-4" aria-hidden />}>
          Back
        </Button>
        <Button onClick={onNext} disabled={!!problem} icon={<ArrowRight className="size-4" aria-hidden />} className="flex-row-reverse">
          Review rows
        </Button>
      </div>
    </div>
  );
}

function StatTile({ value, label, tone }: { value: number; label: string; tone: "teal" | "gold" | "danger" | "slate" }) {
  return (
    <div
      className={cn(
        "rounded-xl px-4 py-3",
        tone === "teal" && "bg-teal-soft text-teal-ink",
        tone === "gold" && "bg-gold-soft text-gold-ink",
        tone === "danger" && "bg-danger-soft text-danger-ink",
        tone === "slate" && "bg-slate-soft text-navy",
      )}
    >
      <p className="font-heading text-2xl font-extrabold">{value}</p>
      <p className="text-xs font-semibold">{label}</p>
    </div>
  );
}

function ReviewStep({
  review,
  choices,
  setChoices,
  fileName,
  onBack,
  onNext,
}: {
  review: ImportReview;
  choices: Record<number, DuplicateChoice>;
  setChoices: (c: Record<number, DuplicateChoice>) => void;
  fileName: string;
  onBack: () => void;
  onNext: () => void;
}) {
  const left = review.duplicates.filter((d) => !choices[d.rowNumber]).length;
  const errorReport = () =>
    downloadCsv(`${fileName.replace(/\.csv$/i, "")}_error_report.csv`, [
      ["Notebook row", "Name", "Phone as written", "Problem"],
      ...review.errors.map((e) => [e.rowNumber, e.name, e.rawPhone, e.error ?? ""]),
    ]);
  return (
    <div className="p-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile value={review.ready.length} label="Ready to import" tone="teal" />
        <StatTile value={left} label={left === 1 ? "Possible duplicate left" : "Possible duplicates left"} tone="gold" />
        <StatTile value={review.errors.length} label="Rows need fixing" tone="danger" />
        <StatTile value={review.normalised} label="Phones normalised to +231" tone="slate" />
      </div>
      {review.blank > 0 && <p className="mt-3 text-xs text-muted">{plural(review.blank, "blank row")} skipped.</p>}

      {review.duplicates.length > 0 && (
        <div className="mt-5">
          <h3 className="mb-2 text-sm font-bold text-navy">Possible duplicates: choose what to do with each</h3>
          <ul className="flex flex-col gap-2">
            {review.duplicates.map((d) => (
              <DuplicateCard key={d.rowNumber} row={d} choice={choices[d.rowNumber]} onChoose={(c) => setChoices({ ...choices, [d.rowNumber]: c })} />
            ))}
          </ul>
        </div>
      )}

      {review.errors.length > 0 && (
        <details className="mt-5 rounded-2xl border border-line">
          <summary className="flex min-h-11 cursor-pointer items-center justify-between gap-3 px-4 py-2 text-sm font-semibold text-navy">
            {plural(review.errors.length, "row")} won&apos;t be imported. See why
          </summary>
          <ul className="divide-y divide-line border-t border-line text-sm">
            {review.errors.map((e) => (
              <li key={e.rowNumber} className="grid gap-1 px-4 py-2.5 sm:grid-cols-[6rem_12rem_1fr]">
                <span className="text-muted">Row {e.rowNumber}</span>
                <span className="font-medium text-ink">{e.name || "(no name)"}</span>
                <span className="text-danger-ink">{e.error}</span>
              </li>
            ))}
          </ul>
        </details>
      )}

      {review.ready.length > 0 && (
        <details className="mt-3 rounded-2xl border border-line">
          <summary className="flex min-h-11 cursor-pointer items-center px-4 py-2 text-sm font-semibold text-navy">Preview the first rows to be imported</summary>
          <ul className="divide-y divide-line border-t border-line text-sm">
            {review.ready.slice(0, 8).map((r) => (
              <li key={r.rowNumber} className="grid gap-1 px-4 py-2.5 sm:grid-cols-[14rem_1fr]">
                <span className="font-medium text-ink">{r.name}</span>
                <span className="text-muted">
                  {r.normalised ? (
                    <>
                      {r.rawPhone} <ArrowRight className="inline size-3" aria-label="becomes" /> <span className="text-teal-ink">{formatPhone(r.phone)}</span>
                    </>
                  ) : (
                    formatPhone(r.phone)
                  )}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}

      <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="secondary" onClick={onBack} icon={<ArrowLeft className="size-4" aria-hidden />}>
            Back
          </Button>
          {review.errors.length > 0 && (
            <button type="button" onClick={errorReport} className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-teal-ink underline underline-offset-4">
              <Download className="size-4" aria-hidden />
              Download error report ({plural(review.errors.length, "row")})
            </button>
          )}
        </div>
        <Button onClick={onNext} disabled={left > 0} variant={left > 0 ? "secondary" : "primary"}>
          {left > 0 ? `Resolve ${plural(left, "duplicate")} to continue` : "Continue to confirm"}
        </Button>
      </div>
    </div>
  );
}

function DuplicateCard({ row, choice, onChoose }: { row: ReviewRow; choice?: DuplicateChoice; onChoose: (c: DuplicateChoice) => void }) {
  const m = row.duplicate!.member;
  const options: { id: DuplicateChoice; label: string }[] = [
    { id: "merge", label: "Merge" },
    { id: "keep", label: "Keep both" },
    { id: "skip", label: "Skip row" },
  ];
  return (
    <li className={cn("flex flex-col gap-3 rounded-2xl border p-4 lg:flex-row lg:items-center", choice ? "border-line bg-white" : "border-gold/70 bg-gold-soft/60")}>
      <div className="grid flex-1 gap-2 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
        <div>
          <p className="text-xs font-semibold text-gold-ink">Notebook row {row.rowNumber}</p>
          <p className="font-semibold text-navy">{row.name}</p>
          <p className="text-xs text-muted">
            {row.rawPhone} <ArrowRight className="inline size-3" aria-label="becomes" /> {formatPhone(row.phone)}
          </p>
        </div>
        <ArrowRight className="hidden size-4 text-muted sm:block" aria-hidden />
        <div>
          <p className="text-xs text-muted">Existing member</p>
          <p className="font-semibold text-navy">
            {m.first_name} {m.last_name}
          </p>
          <p className="text-xs text-muted">{row.duplicate!.reason}</p>
        </div>
      </div>
      <div role="group" aria-label={`What to do with notebook row ${row.rowNumber}`} className="flex shrink-0 gap-2">
        {options.map((o) => (
          <Button key={o.id} size="sm" variant={choice === o.id ? "primary" : "secondary"} aria-pressed={choice === o.id} onClick={() => onChoose(o.id)}>
            {o.label}
          </Button>
        ))}
      </div>
    </li>
  );
}

function ConfirmStep({
  review,
  choices,
  onBack,
  onConfirm,
}: {
  review: ImportReview;
  choices: Record<number, DuplicateChoice>;
  onBack: () => void;
  onConfirm: () => void;
}) {
  const keep = review.duplicates.filter((d) => choices[d.rowNumber] === "keep").length;
  const merge = review.duplicates.filter((d) => choices[d.rowNumber] === "merge").length;
  const skip = review.duplicates.filter((d) => choices[d.rowNumber] === "skip").length;
  const adding = review.ready.length + keep;
  return (
    <div className="p-5">
      <ul className="flex flex-col gap-2 text-[15px]">
        <li className="flex items-center gap-3">
          <CheckCircle2 className="size-5 text-teal-ink" aria-hidden />
          <span>
            <span className="font-semibold">{plural(adding, "new member")}</span> will be added{keep > 0 ? ` (including ${keep} kept alongside an existing member)` : ""}.
          </span>
        </li>
        {merge > 0 && (
          <li className="flex items-center gap-3">
            <CheckCircle2 className="size-5 text-teal-ink" aria-hidden />
            <span>
              <span className="font-semibold">{merge}</span> will be merged: missing departments and details are added to the existing member.
            </span>
          </li>
        )}
        {skip > 0 && (
          <li className="flex items-center gap-3 text-muted">
            <Check className="size-5" aria-hidden />
            {plural(skip, "row")} skipped.
          </li>
        )}
        {review.errors.length > 0 && (
          <li className="flex items-center gap-3 text-muted">
            <TriangleAlert className="size-5" aria-hidden />
            {plural(review.errors.length, "row")} not imported (listed in the error report).
          </li>
        )}
      </ul>
      <p className="mt-4 rounded-xl bg-cloud px-4 py-3 text-sm text-ink">
        Phones are saved in +231 format. Imported members show as <span className="font-semibold">New</span> until their first check-in, so the import never marks
        anyone inactive.
      </p>
      <div className="mt-5 flex justify-between gap-2">
        <Button variant="secondary" onClick={onBack} icon={<ArrowLeft className="size-4" aria-hidden />}>
          Back
        </Button>
        <Button onClick={onConfirm} variant="teal">
          Import {plural(adding, "member")}
        </Button>
      </div>
    </div>
  );
}
