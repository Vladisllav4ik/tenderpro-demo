import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Box,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Columns3,
  ExternalLink,
  Filter,
  Maximize,
  Minimize,
  Minus,
  MoreHorizontal,
  Plus,
  RotateCw,
  Search,
  Sparkles,
  X,
  FileSpreadsheet,
  Truck,
  Cog,
  Construction,
  Wrench,
  Briefcase,
  Package,
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

import { money, type Tender } from "@/lib/demo-data";
import { useDemo } from "@/lib/demo-store";
import {
  useWorkspaceState,
  readWorkspace,
  writeWorkspace,
} from "@/lib/workspace-state";
import { toast } from "sonner";
import {
  statusLabel,
  statusTone,
  periodInfo,
  shortDate,
  fullDate,
} from "@/lib/tender-workflow";
import {
  sheetColumns as columns,
  categoryLabel,
  periodCaption,
  prozorroLink as prozorro,
  type ColumnKey,
} from "@/lib/worksheet-model";
import type { DetailFlow } from "@/lib/tender-detail";

const scales = [100, 125, 150, 175, 200];
const navigation = [
  ["/tenders", "Тендери"],
  ["/dashboard", "Аналіз"],
  ["/inbox", "Імпорт / Джерела"],
  ["/categories", "Категорії"],
  ["/settings", "Налаштування"],
  ["/profile", "Профіль"],
] as const;
export function TenderWorksheet({
  items,
  total,
  query,
  onQueryChange,
  viewTabs,
  filters,
  actions,
  details,
}: {
  items: Tender[];
  total: number;
  query: string;
  onQueryChange: (value: string) => void;
  viewTabs: ReactNode;
  filters: ReactNode;
  actions: ReactNode;
  details: (t: Tender) => DetailFlow;
}) {
  const navigate = useNavigate();
  const { state, viewTender, saveComment, now, ready } = useDemo();
  const [zoom, setZoom, workspaceReady] = useWorkspaceState("zoom", 100, (v) =>
    scales.includes(v as number),
  );
  const [fullscreenPreferred, setFullscreenPreferred] = useWorkspaceState(
    "fullscreenPreferred",
    false,
    (v) => typeof v === "boolean",
  );
  const [focus, setFocus] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [viewport, setViewport] = useState(1366);
  const [showAI, setShowAI] = useWorkspaceState(
    "aiVisible",
    true,
    (v) => typeof v === "boolean",
  );
  const [aiOpen, setAiOpen] = useWorkspaceState(
    "aiPanelOpen",
    false,
    (v) => typeof v === "boolean",
  );
  const [columnState, setColumnState] = useWorkspaceState<{
    visible: ColumnKey[];
    order: ColumnKey[];
    widths: Partial<Record<ColumnKey, number>>;
  }>(
    "columns",
    {
      visible: columns
        .filter((c) => !["budget", "region", "stage"].includes(c.key))
        .map((c) => c.key),
      order: columns.map((c) => c.key),
      widths: {},
    },
    (v) => {
      if (!v || typeof v !== "object") return false;
      const saved = v as {
        visible: unknown[];
        order: unknown[];
        widths: Record<string, unknown>;
      };
      return (
        Array.isArray(saved.visible) &&
        Array.isArray(saved.order) &&
        !!saved.widths &&
        typeof saved.widths === "object" &&
        [...saved.visible, ...saved.order].every((key) =>
          columns.some((c) => c.key === key),
        ) &&
        Object.entries(saved.widths).every(
          ([key, width]) =>
            columns.some((c) => c.key === key) &&
            typeof width === "number" &&
            Number.isFinite(width) &&
            width >= 44 &&
            width <= 600,
        )
      );
    },
  );
  const visible = columnState.visible;
  const setVisible = (update: (value: ColumnKey[]) => ColumnKey[]) =>
    setColumnState((s) => ({ ...s, visible: update(s.visible) }));
  const [sort, setSort] = useWorkspaceState<{
    key: ColumnKey;
    direction: 1 | -1;
  }>(
    "sort",
    { key: "score", direction: -1 },
    (v) =>
      !!v &&
      typeof v === "object" &&
      columns.some(
        (c) => c.key === (v as { key: string; direction: number }).key,
      ) &&
      [1, -1].includes((v as { key: string; direction: number }).direction),
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useWorkspaceState<string | null>(
    "selectedTenderId",
    null,
    (v) => v === null || typeof v === "string",
  );
  // Drafts autosave independently from delayed status processing.
  const [comments, setComments] = useState<Record<string, string>>({});
  const [page, setPage] = useWorkspaceState(
    "page",
    1,
    (v) => Number.isInteger(v) && Number(v) > 0,
  );
  const [pageSize, setPageSize] = useWorkspaceState("rowsPerPage", 50, (v) =>
    [25, 50, 100].includes(v as number),
  );
  const scroller = useRef<HTMLDivElement>(null);
  const selected = state.tenders.find((t) => t.id === selectedId) ?? items[0];
  const editing =
    editingId && !items.some((t) => t.id === editingId)
      ? state.tenders.find((t) => t.id === editingId)
      : undefined;
  const displayItems = editing ? [...items, editing] : items;
  const flow = selected ? details(selected) : null;
  const optionalOrder = [
    ...new Set([...columnState.order, ...columns.map((c) => c.key)]),
  ].filter((k) => !["number", "comment", "status"].includes(k));
  const orderedColumns = ["number", "comment", ...optionalOrder, "status"]
    .map((key) => columns.find((c) => c.key === key))
    .filter((c): c is (typeof columns)[number] => !!c);
  const activeColumns = orderedColumns.filter((c) =>
    c.key === "score"
      ? showAI
      : ["number", "comment", "title"].includes(c.key) ||
        visible.includes(c.key),
  );
  const draftTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const saveRef = useRef(saveComment);
  saveRef.current = saveComment;
  const pendingComments = useRef(new Map<string, string>());
  const autosave = (id: string, text: string) => {
    setComments((notes) => ({ ...notes, [id]: text }));
    pendingComments.current.set(id, text);
    clearTimeout(draftTimers.current.get(id));
    draftTimers.current.set(
      id,
      setTimeout(() => {
        saveRef.current(id, text);
        pendingComments.current.delete(id);
        draftTimers.current.delete(id);
      }, 750),
    );
  };
  useEffect(() => {
    const flush = () => {
      pendingComments.current.forEach((text, id) => saveRef.current(id, text));
      pendingComments.current.clear();
      draftTimers.current.forEach(clearTimeout);
      draftTimers.current.clear();
    };
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, []);
  useEffect(() => {
    if (!workspaceReady || !ready || !scroller.current) return;
    const frame = requestAnimationFrame(() => {
      scroller.current?.scrollTo({
        left: Number(readWorkspace("scrollX", 0)) || 0,
        top: Number(readWorkspace("scrollY", 0)) || 0,
      });
      if (scroller.current) {
        writeWorkspace("scrollX", scroller.current.scrollLeft);
        writeWorkspace("scrollY", scroller.current.scrollTop);
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [workspaceReady, ready]);
  const moveColumn = (key: ColumnKey, direction: number) => {
    const order = optionalOrder.slice();
    const index = order.indexOf(key);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= order.length) return;
    [order[index], order[target]] = [order[target]!, order[index]!];
    setColumnState((s) => ({
      ...s,
      order: ["number", "comment", ...order, "status"],
    }));
  };
  const resizeColumn = (key: ColumnKey, event: React.PointerEvent) => {
    event.preventDefault();
    event.stopPropagation();
    const element = event.currentTarget as HTMLElement;
    element.setPointerCapture(event.pointerId);
    const startX = event.clientX;
    const width =
      columnState.widths[key] ?? columns.find((c) => c.key === key)!.width;
    const move = (e: PointerEvent) =>
      setColumnState((s) => ({
        ...s,
        widths: {
          ...s.widths,
          [key]: Math.max(
            key === "number" ? 44 : 90,
            Math.min(
              key === "number" ? 80 : 600,
              width + ((e.clientX - startX) * 100) / zoom,
            ),
          ),
        },
      }));
    const stop = () => {
      element.removeEventListener("pointermove", move);
      element.removeEventListener("pointerup", stop);
      element.removeEventListener("lostpointercapture", stop);
    };
    element.addEventListener("pointermove", move);
    element.addEventListener("pointerup", stop);
    element.addEventListener("lostpointercapture", stop);
  };
  const sorted = useMemo(
    () =>
      [...displayItems].sort((a, b) => {
        const value = (t: Tender): string | number =>
          sort.key === "number"
            ? displayItems.indexOf(t)
            : sort.key === "comment"
              ? (comments[t.id] ?? t.comment ?? "")
              : sort.key === "link"
                ? t.id
                : sort.key === "period"
                  ? t.deadline.split(".").reverse().join("-")
                  : t[sort.key];
        const av = value(a),
          bv = value(b);
        return (
          (typeof av === "number" && typeof bv === "number"
            ? av - bv
            : String(av).localeCompare(String(bv), "uk")) * sort.direction
        );
      }),
    [items, state.tenders, editingId, sort, comments],
  );
  const pages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const currentPage = Math.min(page, pages);
  const start = (currentPage - 1) * pageSize;
  const rows = sorted.slice(start, start + pageSize);
  useEffect(() => {
    const update = () => {
      const active = !!document.fullscreenElement;
      setFocus(active);
      if (active) setAiOpen(false);
    };
    update();
    document.addEventListener("fullscreenchange", update);
    return () => document.removeEventListener("fullscreenchange", update);
  }, []);
  useEffect(() => {
    if (!scroller.current) return;
    const observer = new ResizeObserver((entries) => {
      setViewport(entries[0]?.contentRect.width ?? 1366);
    });
    observer.observe(scroller.current);
    return () => observer.disconnect();
  }, []);
  const fullscreen = async () => {
    setAiOpen(false);
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        setFullscreenPreferred(false);
      } else {
        await document.documentElement.requestFullscreen({
          navigationUI: "hide",
        });
        setFullscreenPreferred(true);
      }
    } catch (error) {
      console.error(error);
      toast.info(
        "Браузер не дозволив fullscreen. Спробуйте кнопку у звичайному вікні.",
      );
    }
  };
  const scaleStep = (direction: number) =>
    setZoom(
      scales[
        Math.max(
          0,
          Math.min(scales.length - 1, scales.indexOf(zoom) + direction),
        )
      ] ?? 100,
    );
  const selectColumn = (key: ColumnKey, checked: boolean) => {
    if (key === "score") {
      setShowAI(checked);
      return;
    }
    setVisible((v) => (checked ? [...v, key] : v.filter((k) => k !== key)));
  };
  const columnWidth = (c: (typeof columns)[number]) =>
    c.key === "comment"
      ? Math.min(
          ((columnState.widths[c.key] ?? c.width) * zoom) / 100,
          Math.max(130, viewport * 0.22),
        )
      : (c.width * zoom) / 100;
  const selectTender = (t: Tender) => {
    setSelectedId(t.id);
    viewTender(t.id);
  };
  const commitComment = (t: Tender, text: string) => {
    clearTimeout(draftTimers.current.get(t.id));
    pendingComments.current.delete(t.id);
    saveComment(t.id, text);
    setComments((drafts) => {
      const { [t.id]: removed, ...rest } = drafts;
      return rest;
    });
  };
  const exportExcel = async () => {
    setExporting(true);
    try {
      const { downloadWorksheet } = await import("@/lib/worksheet-export");
      await downloadWorksheet(
        sorted.map((t) => ({
          ...t,
          comment: comments[t.id] ?? t.comment ?? "",
        })),
        activeColumns.map((c) => ({ ...c, width: columnWidth(c) })),
        zoom,
        now,
      );
      toast.success("Excel-файл готовий");
    } catch (error) {
      console.error(error);
      toast.error("Не вдалося сформувати Excel-файл");
    } finally {
      setExporting(false);
    }
  };
  const changePage = (value: number) => {
    setPage(value);
    scroller.current?.scrollTo({ top: 0 });
  };

  return (
    <section
      className={`sheet-workspace ${focus ? "is-focus" : ""}`}
      style={
        {
          "--sheet-zoom": zoom / 100,
          "--frozen-number-width": `${columnWidth(columns[0])}px`,
        } as CSSProperties
      }
      aria-label="Робочий лист тендерів"
    >
      <header className="sheet-toolbar">
        <Link
          to="/tenders"
          className="sheet-brand"
          aria-label="TenderPro — Тендери"
        >
          <span className="sheet-mark">
            <Box />
          </span>
          <strong>TenderPro</strong>
        </Link>
        <Popover>
          <PopoverTrigger asChild>
            <button className="sheet-tool sheet-section">
              <Columns3 />
              <span>Тендери</span>
              <ChevronDown />
            </button>
          </PopoverTrigger>
          <PopoverContent className="sheet-menu" align="start">
            <p className="sheet-menu-heading">Робочий простір</p>
            {navigation.map(([to, label]) => (
              <Link className="sheet-nav-link" key={to} to={to}>
                {label}
                {to === "/tenders" && <span className="sheet-nav-dot" />}
              </Link>
            ))}
          </PopoverContent>
        </Popover>
        <label className="sheet-search">
          <Search />
          <input
            aria-label="Пошук тендерів"
            placeholder="Пошук по назві, замовнику, ID…"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
          />
          {query && (
            <button
              aria-label="Очистити пошук"
              onClick={() => onQueryChange("")}
            >
              <X />
            </button>
          )}
        </label>
        <div className="sheet-zoom">
          <button
            aria-label="Зменшити масштаб"
            disabled={zoom === 100}
            onClick={() => scaleStep(-1)}
          >
            <Minus />
          </button>
          <select
            aria-label="Масштаб таблиці"
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
          >
            {scales.map((value) => (
              <option key={value} value={value}>
                {value}%
              </option>
            ))}
          </select>
          <button
            aria-label="Збільшити масштаб"
            disabled={zoom === 200}
            onClick={() => scaleStep(1)}
          >
            <Plus />
          </button>
        </div>
        <button
          className={`sheet-tool sheet-icon ${focus ? "is-active" : ""}`}
          aria-label={focus ? "Вийти з fullscreen" : "Fullscreen"}
          aria-pressed={focus}
          onClick={fullscreen}
        >
          {focus ? <Minimize /> : <Maximize />}
        </button>
        <label className="sheet-ai-toggle">
          <input
            type="checkbox"
            checked={showAI}
            onChange={(e) => setShowAI(e.target.checked)}
          />
          <span>AI</span>
        </label>
        <Popover>
          <PopoverTrigger asChild>
            <button className="sheet-tool">
              <Columns3 />
              <span>Колонки</span>
            </button>
          </PopoverTrigger>
          <PopoverContent className="sheet-menu sheet-column-menu" align="end">
            <p className="sheet-menu-heading">Видимі колонки</p>
            {orderedColumns.map((c, index) => (
              <label key={c.key}>
                <input
                  type="checkbox"
                  disabled={["number", "comment", "title"].includes(c.key)}
                  checked={c.key === "score" ? showAI : visible.includes(c.key)}
                  onChange={(e) => selectColumn(c.key, e.target.checked)}
                />
                <span>{c.label}</span>
                {!["number", "comment", "status"].includes(c.key) && (
                  <>
                    <button
                      aria-label={`Перемістити ${c.label} ліворуч`}
                      onClick={(e) => {
                        e.preventDefault();
                        moveColumn(c.key, -1);
                      }}
                    >
                      ←
                    </button>
                    <button
                      aria-label={`Перемістити ${c.label} праворуч`}
                      onClick={(e) => {
                        e.preventDefault();
                        moveColumn(c.key, 1);
                      }}
                    >
                      →
                    </button>
                  </>
                )}
              </label>
            ))}
            <p className="sheet-menu-note">
              CPV, дата публікації та тип процедури — після появи цих даних.
            </p>
          </PopoverContent>
        </Popover>
        <Popover>
          <PopoverTrigger asChild>
            <button className="sheet-tool">
              <Filter />
              <span>Фільтри</span>
            </button>
          </PopoverTrigger>
          <PopoverContent className="sheet-menu sheet-filter-menu" align="end">
            <p className="sheet-menu-heading">Фільтри тендерів</p>
            {filters}
          </PopoverContent>
        </Popover>
        <span className="sheet-total">
          Всього: {total.toLocaleString("uk-UA")}
        </span>
        <button
          className="sheet-tool sheet-icon"
          aria-label="Оновити вигляд таблиці"
          title="Оновити вигляд таблиці"
          onClick={() => {
            setSort({ key: "score", direction: -1 });
            setPage(1);
            scroller.current?.scrollTo({ top: 0, left: 0 });
          }}
        >
          <RotateCw />
        </button>
        <Popover>
          <PopoverTrigger asChild>
            <button
              className="sheet-tool sheet-icon"
              aria-label="Імпорт та дії"
            >
              <MoreHorizontal />
            </button>
          </PopoverTrigger>
          <PopoverContent className="sheet-menu sheet-actions" align="end">
            <p className="sheet-menu-heading">Імпорт та дії</p>
            {actions}
          </PopoverContent>
        </Popover>
      </header>
      <div className="sheet-viewbar">
        <div className="sheet-views">{viewTabs}</div>
        {fullscreenPreferred && !focus && (
          <button className="sheet-restore-fullscreen" onClick={fullscreen}>
            Повернути повноекранний режим
          </button>
        )}
        <div className="sheet-data-tools">
          {" "}
          <span
            className="sheet-data-period"
            title="Дата публікації у demo визначена з ID тендера"
          >
            {periodCaption(items, now)}
          </span>
          <button
            className="sheet-tool sheet-excel"
            onClick={exportExcel}
            disabled={exporting || !items.length}
          >
            <FileSpreadsheet />
            {exporting ? "Експорт…" : "Excel"}
          </button>
        </div>
      </div>
      <div
        ref={scroller}
        onScroll={(e) => {
          writeWorkspace("scrollX", e.currentTarget.scrollLeft);
          writeWorkspace("scrollY", e.currentTarget.scrollTop);
        }}
        className="sheet-scroll"
        tabIndex={0}
        aria-label="Таблиця тендерів, горизонтальне та вертикальне прокручування"
      >
        <table
          className="sheet-table"
          style={{
            width: `${activeColumns.reduce((sum, c) => sum + columnWidth(c), 0)}px`,
          }}
        >
          <colgroup>
            {activeColumns.map((c) => (
              <col key={c.key} style={{ width: columnWidth(c) }} />
            ))}
          </colgroup>
          <thead>
            <tr>
              {activeColumns.map((c) => (
                <th
                  key={c.key}
                  scope="col"
                  className={`sheet-head-${c.key}`}
                  aria-sort={
                    sort.key === c.key
                      ? sort.direction === 1
                        ? "ascending"
                        : "descending"
                      : "none"
                  }
                >
                  <button
                    onClick={() =>
                      setSort((s) => ({
                        key: c.key,
                        direction:
                          s.key === c.key ? (s.direction === 1 ? -1 : 1) : 1,
                      }))
                    }
                    aria-label={c.label}
                    title={c.label}
                  >
                    {c.key === "link" ? <ExternalLink /> : c.label}
                    {!["number", "link"].includes(c.key) &&
                      (sort.key === c.key ? (
                        sort.direction === 1 ? (
                          <ArrowUp />
                        ) : (
                          <ArrowDown />
                        )
                      ) : (
                        <ArrowUpDown />
                      ))}
                  </button>
                  <span
                    role="separator"
                    aria-label={`Ширина ${c.label}`}
                    className="sheet-resize"
                    onPointerDown={(e) => resizeColumn(c.key, e)}
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((t, index) => (
              <tr
                key={t.id}
                className={selectedId === t.id ? "is-selected" : ""}
                aria-selected={selectedId === t.id}
                onClick={() => selectTender(t)}
                onDoubleClick={(e) => {
                  if (
                    (e.target as HTMLElement).closest(
                      "textarea, .sheet-cell-comment, a",
                    )
                  )
                    return;
                  selectTender(t);
                  void navigate({ to: "/tenders/$id", params: { id: t.id } });
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  selectTender(t);
                  setAiOpen(true);
                }}
                onFocus={() => selectTender(t)}
              >
                {activeColumns.map((c) => (
                  <td key={c.key} className={`sheet-cell-${c.key}`}>
                    {c.key === "number" ? (
                      start + index + 1
                    ) : c.key === "title" ? (
                      <button
                        className="sheet-title"
                        title={t.title}
                        onClick={() => setSelectedId(t.id)}
                      >
                        {t.title}
                      </button>
                    ) : c.key === "topCategory" ? (
                      <span className="sheet-category" title={t.category}>
                        {(() => {
                          const label = categoryLabel(t);
                          const Icon =
                            label === "Техніка"
                              ? Truck
                              : label === "Запчастини"
                                ? Cog
                                : label === "Будівництво"
                                  ? Construction
                                  : label === "Обладнання"
                                    ? Wrench
                                    : label === "Послуги"
                                      ? Briefcase
                                      : Package;
                          return (
                            <>
                              <Icon />
                              {label}
                            </>
                          );
                        })()}
                      </span>
                    ) : c.key === "link" ? (
                      <a
                        className="sheet-external"
                        href={prozorro(t)}
                        onClick={() => selectTender(t)}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={`Відкрити Prozorro: ${t.title}`}
                      >
                        <ExternalLink />
                      </a>
                    ) : c.key === "score" ? (
                      <span
                        className={`sheet-score tone-${t.score >= 80 ? "green" : t.score >= 50 ? "yellow" : "red"}`}
                        title={`Пріоритет ${t.priority}`}
                        aria-label={`AI score ${t.score}, пріоритет ${t.priority}`}
                      >
                        {t.score}
                        <small>{t.priority}</small>
                      </span>
                    ) : c.key === "status" ? (
                      <span
                        className={`sheet-auto-status tone-${statusTone(t.status)}`}
                        title="Автоматичний статус"
                      >
                        {statusLabel(t.status)}
                      </span>
                    ) : c.key === "comment" ? (
                      editingId === t.id ? (
                        <textarea
                          autoFocus
                          rows={1}
                          aria-label={`Коментар: ${t.title}`}
                          className="sheet-comment"
                          placeholder="Додати коментар…"
                          value={comments[t.id] ?? t.comment ?? ""}
                          onChange={(e) => autosave(t.id, e.target.value)}
                          onFocus={() => setEditingId(t.id)}
                          onBlur={(e) => {
                            commitComment(t, e.target.value);
                            setEditingId(null);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                              e.currentTarget.blur();
                            }
                            if (e.key === "Escape") e.currentTarget.blur();
                          }}
                        />
                      ) : (
                        <button
                          className={`sheet-comment-preview ${t.comment ? "" : "is-empty"}`}
                          aria-label={`Коментар: ${t.title}`}
                          title={t.comment || "Додати коментар"}
                          onFocus={() => setEditingId(t.id)}
                          onClick={() => setEditingId(t.id)}
                        >
                          <span>{t.comment || "Додати коментар…"}</span>
                        </button>
                      )
                    ) : c.key === "period" ? (
                      (() => {
                        const period = periodInfo(t, now);
                        return (
                          <div
                            className={`sheet-period period-${period.tone}`}
                            title={`${fullDate(period.start)} → ${period.end ? fullDate(period.end) : "—"}${t.publicationDateSource === "tender-id" ? " · дата публікації з ID (демо)" : ""}`}
                          >
                            <span>
                              {shortDate(period.start)} <i>→</i>{" "}
                              <strong>
                                {period.end ? shortDate(period.end) : "—"}
                              </strong>
                            </span>
                            <small>{period.label}</small>
                          </div>
                        );
                      })()
                    ) : c.key === "budget" ? (
                      money(t.budget)
                    ) : (
                      <span title={String(t[c.key])}>{t[c.key]}</span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={activeColumns.length} className="sheet-empty">
                  Тендерів за цими умовами не знайдено. Змініть пошук або
                  фільтри.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <footer className="sheet-footer">
        <span>
          Показано {rows.length ? start + 1 : 0}–{start + rows.length} з{" "}
          {sorted.length}
          <small>Автозбереження · статус перераховується окремо</small>
        </span>
        <div className="sheet-pagination">
          <select
            aria-label="Рядків на сторінці"
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(1);
            }}
          >
            {[25, 50, 100].map((size) => (
              <option key={size} value={size}>
                {size} на сторінці
              </option>
            ))}
          </select>
          <button
            aria-label="Попередня сторінка"
            disabled={currentPage === 1}
            onClick={() => changePage(currentPage - 1)}
          >
            <ChevronLeft />
          </button>
          {Array.from({ length: pages }, (_, i) => i + 1).map((value) => (
            <button
              key={value}
              className={currentPage === value ? "is-active" : ""}
              aria-current={currentPage === value ? "page" : undefined}
              onClick={() => changePage(value)}
            >
              {value}
            </button>
          ))}
          <button
            aria-label="Наступна сторінка"
            disabled={currentPage === pages}
            onClick={() => changePage(currentPage + 1)}
          >
            <ChevronRight />
          </button>
        </div>
      </footer>
      <button
        className={`sheet-ai-tab ${aiOpen ? "is-open" : ""}`}
        aria-expanded={aiOpen}
        aria-controls="tender-ai-panel"
        aria-label={aiOpen ? "Згорнути AI-панель" : "Відкрити AI-панель"}
        onClick={() => {
          if (!aiOpen && selected) selectTender(selected);
          setAiOpen((v) => !v);
        }}
      >
        <Sparkles />
        <strong>AI</strong>
        {aiOpen ? <ChevronRight /> : <ChevronLeft />}
      </button>
      {aiOpen && (
        <aside
          id="tender-ai-panel"
          className="sheet-ai-panel"
          aria-label="AI-панель тендера"
        >
          <div className="sheet-panel-head">
            <span>
              <Sparkles /> AI · швидкий огляд
            </span>
            <button
              aria-label="Закрити AI-панель"
              onClick={() => setAiOpen(false)}
            >
              <X />
            </button>
          </div>
          {selected && flow ? (
            <>
              <div className="sheet-panel-content">
                <span className="sheet-eyebrow">ВИБРАНИЙ ТЕНДЕР</span>
                <h2>{selected.title}</h2>
                <p className="sheet-panel-customer">{selected.customer}</p>
                <dl className="sheet-panel-facts">
                  {[
                    ["Сума", money(selected.budget)],
                    [
                      "Період",
                      `${shortDate(periodInfo(selected, now).start)} → ${selected.deadline.slice(0, 5)}`,
                    ],
                    ["Залишилось", periodInfo(selected, now).label],
                    ["Категорія", selected.topCategory],
                    [
                      "AI score",
                      `${selected.score}/100 · ${selected.priority}`,
                    ],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <dt>{label}</dt>
                      <dd>{value}</dd>
                    </div>
                  ))}
                </dl>
                <section className="sheet-ai-summary">
                  <h3>
                    <Sparkles /> AI висновок
                  </h3>
                  <p>{flow.summary}</p>
                </section>
                <h3 className="sheet-panel-heading">Ключові параметри</h3>
                {flow.parts.length ? (
                  <ul className="sheet-param-list">
                    {flow.parts.slice(0, 4).map((part) => (
                      <li key={part.code}>
                        <b>{part.code}</b>
                        <span>
                          {part.brand} · {part.qty} шт.
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <ul className="sheet-param-list">
                    {flow.technical.slice(0, 6).map(([label, value]) => (
                      <li key={label}>
                        <span>{label}</span>
                        <b>{value}</b>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="sheet-panel-heading">
                  {flow.documents.length} документів
                </p>
                <div className="sheet-risk-tags">
                  {flow.risks.slice(0, 2).map((risk) => (
                    <span key={risk}>{risk}</span>
                  ))}
                </div>
              </div>
              <div className="sheet-panel-footer">
                <Link to="/tenders/$id" params={{ id: selected.id }}>
                  Відкрити картку <ChevronRight />
                </Link>
                <a href={prozorro(selected)} target="_blank" rel="noreferrer">
                  Відкрити Prozorro <ExternalLink />
                </a>
              </div>
            </>
          ) : (
            <p className="sheet-panel-content">Виберіть тендер у таблиці.</p>
          )}
        </aside>
      )}
    </section>
  );
}
