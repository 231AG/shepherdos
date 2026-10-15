"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { BookOpen, ChevronLeft, ChevronRight, Minus, Plus, RotateCw, Search, X } from "lucide-react";
import { cn, plural } from "@/lib/cn";
import { ROLES } from "@/lib/roles";
import { Button, IconButton } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input, Select } from "@/components/ui/Field";
import { Chips } from "@/components/ui/Tabs";
import { EmptyState, Skeleton } from "@/components/ui/misc";
import { toast } from "@/components/ui/Toast";
import { useChurch } from "@/components/shell/ChurchContext";
import { NoAccess } from "@/components/shell/NoAccess";
import { churchHref } from "@/components/shell/nav";

/**
 * KJV reader (public domain). The demo ships six books as separate JSON files
 * under /public/bible, fetched only when opened, so the app bundle stays small.
 */
const BOOKS = [
  { id: "genesis", name: "Genesis", chapters: 50 },
  { id: "psalms", name: "Psalms", chapters: 150 },
  { id: "proverbs", name: "Proverbs", chapters: 31 },
  { id: "matthew", name: "Matthew", chapters: 28 },
  { id: "john", name: "John", chapters: 21 },
  { id: "romans", name: "Romans", chapters: 16 },
] as const;
type BookId = (typeof BOOKS)[number]["id"];
type BookText = { book: string; chapters: string[][] };

const cache = new Map<BookId, Promise<BookText>>();
function loadBook(id: BookId): Promise<BookText> {
  let p = cache.get(id);
  if (!p) {
    p = fetch(`/bible/${id}.json`).then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json() as Promise<BookText>;
    });
    p.catch(() => cache.delete(id));
    cache.set(id, p);
  }
  return p;
}

function useBook(id: BookId) {
  const [state, setState] = useState<{ id: BookId; text: BookText | null; error: boolean }>({ id, text: null, error: false });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    loadBook(id).then(
      (text) => live && setState({ id, text, error: false }),
      () => live && setState({ id, text: null, error: true }),
    );
    return () => {
      live = false;
    };
  }, [id, attempt]);
  const current = state.id === id ? state : { id, text: null, error: false };
  return { ...current, retry: () => setAttempt((a) => a + 1) };
}

const isBook = (v: string | null): v is BookId => BOOKS.some((b) => b.id === v);
const SIZES = ["text-base", "text-[17px]", "text-lg", "text-xl", "text-2xl"];

export function BibleScreen() {
  const { church, role, can } = useChurch();
  const params = useSearchParams();
  const router = useRouter();
  const book = isBook(params.get("book")) ? (params.get("book") as BookId) : "john";
  const meta = BOOKS.find((b) => b.id === book)!;
  const chapter = Math.min(meta.chapters, Math.max(1, Number(params.get("chapter")) || (params.get("book") ? 1 : 3)));
  const verse = Number(params.get("verse")) || null;
  const [size, setSize] = useState(1);
  const [query, setQuery] = useState("");
  const [submitted, setSubmitted] = useState<{ q: string; scope: "book" | "all" } | null>(null);
  const [scope, setScope] = useState<"book" | "all">("book");

  if (!can("bible")) {
    return <NoAccess body={`${ROLES[role].label}: ${ROLES[role].limits}`} primary={{ href: churchHref(church.slug, ""), label: "Back to dashboard" }} />;
  }

  const go = (b: BookId, c: number, v?: number) => {
    const q = new URLSearchParams({ book: b, chapter: String(c) });
    if (v) q.set("verse", String(v));
    router.replace(`${churchHref(church.slug, "bible")}?${q.toString()}`, { scroll: false });
    if (!v) window.scrollTo({ top: 0 });
  };

  const onSearch = (e: FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (q.length < 3) {
      toast("Type at least 3 letters", { tone: "info", body: "Search finds verses containing the word or phrase." });
      return;
    }
    setSubmitted({ q, scope });
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm text-muted">King James Version · Demo includes selected books</p>
          <h1 className="mt-1 text-3xl font-extrabold">Bible</h1>
        </div>
        <form onSubmit={onSearch} role="search" className="flex w-full gap-2 lg:max-w-md">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
            <Input
              type="search"
              aria-label="Search the Bible"
              placeholder="Search words, e.g. shepherd"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                if (!e.target.value) setSubmitted(null);
              }}
              className="pl-9"
            />
          </div>
          <Button type="submit" className="shrink-0">
            Search
          </Button>
        </form>
      </div>

      {submitted ? (
        <SearchResults
          q={submitted.q}
          scope={submitted.scope}
          book={book}
          setScope={(s) => {
            setScope(s);
            setSubmitted({ ...submitted, scope: s });
          }}
          onOpen={(b, c, v) => {
            setSubmitted(null);
            go(b, c, v);
          }}
          onClose={() => {
            setSubmitted(null);
            setQuery("");
          }}
        />
      ) : (
        <Reader book={book} chapter={chapter} verse={verse} size={size} setSize={setSize} go={go} />
      )}
    </div>
  );
}

function Reader({
  book,
  chapter,
  verse,
  size,
  setSize,
  go,
}: {
  book: BookId;
  chapter: number;
  verse: number | null;
  size: number;
  setSize: (n: number) => void;
  go: (b: BookId, c: number, v?: number) => void;
}) {
  const meta = BOOKS.find((b) => b.id === book)!;
  const { text, error, retry } = useBook(book);
  const verses = text?.chapters[chapter - 1] ?? [];
  const highlighted = useRef<HTMLLIElement>(null);
  const idx = BOOKS.findIndex((b) => b.id === book);
  const prev = chapter > 1 ? { b: book, c: chapter - 1 } : idx > 0 ? { b: BOOKS[idx - 1].id, c: BOOKS[idx - 1].chapters } : null;
  const next = chapter < meta.chapters ? { b: book, c: chapter + 1 } : idx < BOOKS.length - 1 ? { b: BOOKS[idx + 1].id, c: 1 } : null;
  const label = (p: { b: BookId; c: number }) => `${p.b === "psalms" ? "Psalm" : BOOKS.find((x) => x.id === p.b)!.name} ${p.c}`;

  useEffect(() => {
    if (verse && text) highlighted.current?.scrollIntoView({ block: "center" });
  }, [verse, text, chapter]);

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3 sm:px-5">
        <Select aria-label="Book" value={book} onChange={(e) => go(e.target.value as BookId, 1)} className="w-32">
          {BOOKS.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </Select>
        <Select aria-label="Chapter" value={chapter} onChange={(e) => go(book, Number(e.target.value))} className="w-32">
          {Array.from({ length: meta.chapters }, (_, i) => (
            <option key={i + 1} value={i + 1}>
              {book === "psalms" ? "Psalm" : "Chapter"} {i + 1}
            </option>
          ))}
        </Select>
        <div className="ml-auto flex items-center gap-1" role="group" aria-label="Text size">
          <IconButton aria-label="Smaller text" disabled={size === 0} onClick={() => setSize(size - 1)} className="disabled:opacity-40">
            <Minus className="size-4" />
          </IconButton>
          <span className="w-8 text-center text-sm font-semibold text-navy" aria-hidden>
            Aa
          </span>
          <IconButton aria-label="Larger text" disabled={size === SIZES.length - 1} onClick={() => setSize(size + 1)} className="disabled:opacity-40">
            <Plus className="size-4" />
          </IconButton>
        </div>
      </div>

      <article className="mx-auto w-full max-w-3xl px-5 py-6 sm:px-8 sm:py-8" aria-busy={!text && !error}>
        <h2 className="font-heading text-2xl font-extrabold sm:text-3xl">
          {book === "psalms" ? "Psalm" : meta.name} {chapter}
        </h2>
        {error ? (
          <EmptyState
            icon={<BookOpen className="size-5" />}
            title={`${meta.name} didn't load`}
            body="Check the connection and try again."
            action={
              <Button variant="secondary" icon={<RotateCw className="size-4" aria-hidden />} onClick={retry}>
                Try again
              </Button>
            }
          />
        ) : !text ? (
          <div className="mt-6 flex flex-col gap-3" aria-label={`Loading ${meta.name}`}>
            {Array.from({ length: 8 }, (_, i) => (
              <Skeleton key={i} className={cn("h-5", i % 3 === 2 ? "w-2/3" : "w-full")} />
            ))}
          </div>
        ) : (
          <ol className={cn("mt-5 flex flex-col gap-2.5 font-serif leading-[1.75] text-ink", SIZES[size])}>
            {verses.map((t, i) => {
              const n = i + 1;
              const on = verse === n;
              return (
                <li key={n} ref={on ? highlighted : undefined} className={cn("-mx-2 rounded-lg px-2", on && "bg-gold-soft")}>
                  <sup className="tabular mr-1.5 select-none font-sans text-[0.65em] font-semibold text-teal-ink">{n}</sup>
                  {t}
                </li>
              );
            })}
          </ol>
        )}
      </article>

      <nav aria-label="Chapters" className="flex items-center justify-between gap-2 border-t border-line px-4 py-3 sm:px-5">
        {prev ? (
          <Button variant="ghost" icon={<ChevronLeft className="size-4" aria-hidden />} onClick={() => go(prev.b, prev.c)}>
            {label(prev)}
          </Button>
        ) : (
          <span />
        )}
        {next ? (
          <Button variant="ghost" onClick={() => go(next.b, next.c)}>
            {label(next)}
            <ChevronRight className="size-4" aria-hidden />
          </Button>
        ) : (
          <span />
        )}
      </nav>
      <p className="border-t border-line bg-cloud px-5 py-3 text-xs text-muted">
        Demo includes selected books: {BOOKS.map((b) => b.name).join(", ")}. The full version has all 66 books.
      </p>
    </Card>
  );
}

interface Hit {
  book: BookId;
  chapter: number;
  verse: number;
  text: string;
}

function SearchResults({
  q,
  scope,
  book,
  setScope,
  onOpen,
  onClose,
}: {
  q: string;
  scope: "book" | "all";
  book: BookId;
  setScope: (s: "book" | "all") => void;
  onOpen: (b: BookId, c: number, v: number) => void;
  onClose: () => void;
}) {
  const ids = useMemo(() => (scope === "all" ? BOOKS.map((b) => b.id) : [book]), [scope, book]);
  const [loaded, setLoaded] = useState<{ key: string; books: Map<BookId, BookText> } | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [limit, setLimit] = useState(50);
  const key = ids.join(",");

  useEffect(() => {
    let live = true;
    Promise.all(ids.map((id) => loadBook(id).then((t) => [id, t] as const))).then(
      (pairs) => live && setLoaded({ key, books: new Map(pairs) }),
      () => live && setFailed(key),
    );
    return () => {
      live = false;
    };
  }, [ids, key]);

  const ready = loaded?.key === key;
  const hits = useMemo(() => {
    if (!ready) return [];
    const needle = q.toLowerCase();
    const out: Hit[] = [];
    for (const id of ids) {
      const t = loaded!.books.get(id)!;
      t.chapters.forEach((vs, ci) =>
        vs.forEach((text, vi) => {
          if (text.toLowerCase().includes(needle)) out.push({ book: id, chapter: ci + 1, verse: vi + 1, text });
        }),
      );
    }
    return out;
  }, [ready, loaded, ids, q]);
  const bookName = BOOKS.find((b) => b.id === book)!.name;

  return (
    <Card>
      <div className="flex flex-col gap-3 border-b border-line px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-[17px] font-bold">
            {ready ? plural(hits.length, "verse") : "Searching"} with &ldquo;{q}&rdquo;
          </h2>
          <p className="text-sm text-muted">{scope === "all" ? "In all six demo books" : `In ${bookName}`}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Chips
            label="Search in"
            items={[
              { id: "book", label: bookName },
              { id: "all", label: "All demo books" },
            ]}
            value={scope}
            onChange={setScope}
          />
          <IconButton aria-label="Close search" onClick={onClose}>
            <X className="size-5" />
          </IconButton>
        </div>
      </div>
      {failed === key ? (
        <EmptyState title="Search couldn't load the books" body="Check the connection and search again." />
      ) : !ready ? (
        <div className="flex flex-col gap-3 p-5">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : hits.length === 0 ? (
        <EmptyState
          icon={<Search className="size-5" />}
          title="No verses found"
          body={scope === "book" ? "Try searching all demo books, or a different word." : "Try a different word or a shorter phrase."}
        />
      ) : (
        <>
          <ul className="divide-y divide-line">
            {hits.slice(0, limit).map((h) => (
              <li key={`${h.book}${h.chapter}:${h.verse}`}>
                <button type="button" onClick={() => onOpen(h.book, h.chapter, h.verse)} className="block w-full px-5 py-3 text-left hover:bg-navy-50">
                  <span className="text-sm font-semibold text-teal-ink">
                    {BOOKS.find((b) => b.id === h.book)!.name} {h.chapter}:{h.verse}
                  </span>
                  <span className="mt-0.5 block font-serif text-[15px] leading-relaxed text-ink">
                    <Highlight text={h.text} q={q} />
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {hits.length > limit && (
            <div className="border-t border-line px-5 py-3">
              <Button variant="ghost" size="sm" onClick={() => setLimit((l) => l + 50)}>
                Show more ({hits.length - limit} left)
              </Button>
            </div>
          )}
        </>
      )}
    </Card>
  );
}

function Highlight({ text, q }: { text: string; q: string }) {
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  if (i < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <mark className="rounded bg-gold-soft px-0.5 text-navy">{text.slice(i, i + q.length)}</mark>
      {text.slice(i + q.length)}
    </>
  );
}
