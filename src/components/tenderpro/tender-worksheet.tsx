import { useAccount } from "@/lib/account";
import { TableRangePicker } from "./table-range-picker";
import { WorksheetImport } from "./worksheet-import";
import type { TableRange } from "@/lib/table-range";
import {
  CommentPalette,
  ObjectsCell,
  SubmissionCell,
  DetailCell,
} from "./worksheet-cells";
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
  Download,
  Upload,
  GripVertical,
  Pin,
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
} from "@/lib/tender-workflow";
import {
  sheetColumns as columns,
  categoryLabel,
  prozorroLink as prozorro,
  type ColumnKey,
  type TableLayout,
  type TableSort,
  defaultLayout,
  migrateLayout,
  validLayout,
  layoutColumns,
  compactOrder,
  detailedOrder,
  tableTender,
  worksheetPreview,
  worksheetSortValue,
  worksheetValue,
  commentFill,
  amount,
} from "@/lib/worksheet-model";
import type { DetailFlow } from "@/lib/tender-detail";

const scales = [100, 125, 150, 175, 200];
export function TenderWorksheet({
  items,
  total,
  query,
  onQueryChange,
  dataRange,
  resolvedRange,
  onRangeChange,
  filters,
  details,
}: {
  items: Tender[];
  total: number;
  query: string;
  onQueryChange: (value: string) => void;
  dataRange: TableRange;
  resolvedRange: { from: string; to: string };
  onRangeChange: (range: TableRange) => void;
  filters: ReactNode;
  details: (t: Tender) => DetailFlow;
}) {
  const account = useAccount();
  const navigation = [
    ["/tenders", "Тендери"],
    ["/settings", "Налаштування"],
    ...(account?.role === "ADMIN" ? [["/agents", "AI Агенти"]] : []),
  ] as const;
  const navigate = useNavigate();
  const [processing, setProcessing] = useState(false);
  const { state, setState, viewTender, saveComment, now, ready } = useDemo();
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
  const [importOpen, setImportOpen] = useState(false);
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
  const [detailed, setDetailed, modeReady] = useWorkspaceState(
    "detailMode",
    false,
    (v) => typeof v === "boolean",
  );
  const [compactLayout, setCompactLayout, compactReady] =
    useWorkspaceState<TableLayout>(
      "compactLayout",
      defaultLayout("compact"),
      validLayout,
      migrateLayout,
    );
  const [detailedLayout, setDetailedLayout, detailedReady] =
    useWorkspaceState<TableLayout>(
      "detailedLayout",
      defaultLayout("detailed"),
      validLayout,
    );
  const columnState = detailed ? detailedLayout : compactLayout;
  const setColumnState = detailed ? setDetailedLayout : setCompactLayout;
  const visible = columnState.visibility;
  const setVisible = (update: (value: ColumnKey[]) => ColumnKey[]) =>
    setColumnState((s) => ({ ...s, visibility: update(s.visibility) }));
  const sort = columnState.sort;
  const setSort = (update: TableSort | ((value: TableSort) => TableSort)) =>
    setColumnState((s) => ({
      ...s,
      sort: typeof update === "function" ? update(s.sort) : update,
    }));
  useEffect(() => {
    if (compactReady && detailedReady)
      writeWorkspace("sort", sort, account?.id);
  }, [sort, compactReady, detailedReady]);
  const draggingColumn = useRef<ColumnKey | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useWorkspaceState<string | null>(
    "selectedTenderId",
    null,
    (v) => v === null || typeof v === "string",
  );
  // Drafts autosave independently from delayed status processing.
  const [comments, setComments] = useState<Record<string, string>>({});
  const scroller = useRef<HTMLDivElement>(null);
  const selected = state.tenders.find((t) => t.id === selectedId) ?? items[0];
  const editing =
    editingId && !items.some((t) => t.id === editingId)
      ? state.tenders.find((t) => t.id === editingId)
      : undefined;
  const displayItems = editing ? [...items, editing] : items;
  const flow = selected ? worksheetPreview(selected, details(selected)) : null;
  const allowedOrder = detailed ? detailedOrder : compactOrder;
  const optionalOrder = [
    ...new Set([...columnState.order, ...allowedOrder]),
  ].filter(
    (k) =>
      allowedOrder.includes(k) &&
      !["number", "comment", "topCategory", "score", "status"].includes(k),
  );
  const orderedColumns = [
    "number",
    "comment",
    ...optionalOrder,
    "topCategory",
    "score",
    "status",
  ]
    .map((key) => columns.find((c) => c.key === key)!)
    .filter(Boolean);
  const activeColumns = layoutColumns(
    columnState,
    detailed ? "detailed" : "compact",
    showAI,
  );
  const tableItems = useMemo(
    () => displayItems.map((t) => tableTender(t, details(t))),
    [items, state.tenders, editingId, details],
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
    if (
      !workspaceReady ||
      !ready ||
      !modeReady ||
      !compactReady ||
      !detailedReady ||
      !scroller.current
    )
      return;
    const frame = requestAnimationFrame(() => {
      scroller.current?.scrollTo({
        left: Number(readWorkspace("scrollX", 0, account?.id)) || 0,
        top: Number(readWorkspace("scrollY", 0, account?.id)) || 0,
      });
      if (scroller.current) {
        writeWorkspace("scrollX", scroller.current.scrollLeft, account?.id);
        writeWorkspace("scrollY", scroller.current.scrollTop, account?.id);
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [workspaceReady, ready, modeReady, compactReady, detailedReady]);
  const moveColumn = (key: ColumnKey, direction: number) => {
    const order = optionalOrder.slice();
    const index = order.indexOf(key);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= order.length) return;
    [order[index], order[target]] = [order[target]!, order[index]!];
    setColumnState((s) => ({
      ...s,
      order: ["number", "comment", ...order, "topCategory", "score", "status"],
    }));
  };
  const reorderColumn = (source: ColumnKey, target: ColumnKey) => {
    if (
      ["number", "comment", "topCategory", "score", "status"].includes(
        source,
      ) ||
      ["number", "comment", "topCategory", "score", "status"].includes(
        target,
      ) ||
      source === target
    )
      return;
    const order = optionalOrder.filter((k) => k !== source);
    order.splice(order.indexOf(target), 0, source);
    setColumnState((s) => ({
      ...s,
      order: ["number", "comment", ...order, "topCategory", "score", "status"],
    }));
  };
  const togglePin = (key: ColumnKey) =>
    setColumnState((s) => ({
      ...s,
      pinned: s.pinned.includes(key)
        ? s.pinned.filter((k) => k !== key)
        : [...s.pinned, key],
    }));
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
            key === "number" ? 44 : key === "score" ? 60 : 90,
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
      [...tableItems].sort((a, b) => {
        const value = (t: Tender): string | number =>
          sort.key === "number"
            ? tableItems.indexOf(t)
            : sort.key === "comment"
              ? (comments[t.id] ?? t.commentText ?? t.comment ?? "")
              : worksheetSortValue(t, sort.key, now);
        const av = value(a),
          bv = value(b);
        return (
          (typeof av === "number" && typeof bv === "number"
            ? av - bv
            : String(av).localeCompare(String(bv), "uk")) * sort.direction
        );
      }),
    [tableItems, sort, comments, now],
  );
  const rows = sorted;
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
  const selectColumn = (key: ColumnKey, checked: boolean) =>
    setVisible((v) =>
      checked ? [...new Set([...v, key])] : v.filter((k) => k !== key),
    );
  const columnWidth = (c: (typeof columns)[number]) =>
    c.key === "comment"
      ? Math.min(
          ((columnState.widths[c.key] ?? c.width) * zoom) / 100,
          Math.max(130, viewport * 0.22),
        )
      : ((columnState.widths[c.key] ?? c.width) * zoom) / 100;
  const pinnedOffsets = new Map<ColumnKey, number>();
  let frozenWidth = 0;
  let canFreezeExtra = true;
  activeColumns.forEach((c) => {
    if (
      ["number", "comment"].includes(c.key) ||
      (canFreezeExtra &&
        columnState.pinned.includes(c.key) &&
        frozenWidth + columnWidth(c) < viewport * 0.65)
    ) {
      pinnedOffsets.set(c.key, frozenWidth);
      frozenWidth += columnWidth(c);
    } else canFreezeExtra = false;
  });
  const cellStyle = (key: ColumnKey, tender?: Tender): CSSProperties => ({
    ...(pinnedOffsets.has(key)
      ? {
          position: "sticky",
          left: pinnedOffsets.get(key),
          zIndex: tender ? 3 : 12,
        }
      : {}),
    ...(key === "comment" && tender && commentFill(tender.commentColor)
      ? { backgroundColor: "#" + commentFill(tender.commentColor) }
      : {}),
  });
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
          comment: comments[t.id] ?? t.commentText ?? t.comment ?? "",
          commentText: comments[t.id] ?? t.commentText ?? t.comment ?? "",
        })),
        activeColumns.map((c) => ({
          ...c,
          width: columnWidth(c),
          pinned: pinnedOffsets.has(c.key),
        })),
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
        <label className="sheet-detail-toggle">
          <input
            type="checkbox"
            checked={detailed}
            onChange={(e) => {
              setDetailed(e.target.checked);
            }}
          />
          <span>Деталізація</span>
        </label>
        <Popover>
          <PopoverTrigger asChild>
            <button className="sheet-tool">
              <Columns3 />
              <span>Колонки</span>
            </button>
          </PopoverTrigger>
          <PopoverContent className="sheet-menu sheet-column-menu" align="end">
            <p className="sheet-menu-heading">
              Колонки · {detailed ? "Деталізація" : "Робочий режим"}
            </p>
            {orderedColumns.map((c, index) => (
              <label
                key={c.key}
                draggable={
                  ![
                    "number",
                    "comment",
                    "topCategory",
                    "score",
                    "status",
                  ].includes(c.key)
                }
                onDragStart={(e) => {
                  draggingColumn.current = c.key;
                  e.dataTransfer.setData("text/plain", c.key);
                }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (draggingColumn.current)
                    reorderColumn(draggingColumn.current, c.key);
                  draggingColumn.current = null;
                }}
              >
                <GripVertical size={12} />
                <input
                  type="checkbox"
                  disabled={["number", "comment", "title"].includes(c.key)}
                  checked={visible.includes(c.key)}
                  onChange={(e) => selectColumn(c.key, e.target.checked)}
                />
                <span>{c.label}</span>
                <input
                  key={`width-${detailed}-${c.key}`}
                  type="number"
                  aria-label={`Ширина: ${c.label}`}
                  min={c.key === "number" ? 44 : c.key === "score" ? 60 : 90}
                  max={c.key === "number" ? 80 : 600}
                  step={10}
                  defaultValue={columnState.widths[c.key] ?? c.width}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => {
                    const width = Number(e.target.value);
                    if (
                      width >=
                        (c.key === "number"
                          ? 44
                          : c.key === "score"
                            ? 60
                            : 90) &&
                      width <= (c.key === "number" ? 80 : 600)
                    )
                      setColumnState((s) => ({
                        ...s,
                        widths: { ...s.widths, [c.key]: width },
                      }));
                  }}
                  onBlur={(e) => {
                    if (!e.currentTarget.checkValidity())
                      e.currentTarget.value = String(
                        columnState.widths[c.key] ?? c.width,
                      );
                  }}
                />
                {c.key !== "status" && (
                  <button
                    aria-label={`Закріпити ${c.label}`}
                    aria-pressed={columnState.pinned.includes(c.key)}
                    disabled={[
                      "number",
                      "comment",
                      "topCategory",
                      "score",
                    ].includes(c.key)}
                    onClick={(e) => {
                      e.preventDefault();
                      togglePin(c.key);
                    }}
                  >
                    <Pin size={12} />
                  </button>
                )}
                {![
                  "number",
                  "comment",
                  "topCategory",
                  "score",
                  "status",
                ].includes(c.key) && (
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
              Перетягніть рядок для зміни порядку. Ширина — розділювач у
              заголовку. Налаштування окремі для кожного режиму.
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
            scroller.current?.scrollTo({ top: 0, left: 0 });
          }}
        >
          <RotateCw />
        </button>
        <button
          className="sheet-tool sheet-icon sheet-excel"
          aria-label="Експортувати таблицю XLSX"
          title="Експортувати поточний вигляд · XLSX"
          onClick={exportExcel}
          disabled={exporting || !items.length}
        >
          <FileSpreadsheet />
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
            <p className="sheet-menu-heading">IMPORT / EXPORT</p>
            <button
              className="sheet-action-item"
              onClick={async () => {
                try {
                  const { downloadImportTemplate } =
                    await import("@/lib/excel-import");
                  await downloadImportTemplate();
                  toast.success("Шаблон Excel готовий");
                } catch {
                  toast.error("Не вдалося створити шаблон");
                }
              }}
            >
              <Download size={16} />
              Завантажити шаблон Excel
            </button>
            <button
              className="sheet-action-item"
              onClick={() => setImportOpen(true)}
            >
              <Upload size={16} />
              Імпортувати Excel
            </button>
            <button
              className="sheet-action-item"
              onClick={exportExcel}
              disabled={exporting || !items.length}
            >
              <FileSpreadsheet size={16} />
              Експортувати таблицю
            </button>
          </PopoverContent>
        </Popover>
      </header>
      <WorksheetImport open={importOpen} onOpenChange={setImportOpen} />
      <div className="sheet-viewbar sheet-rangebar">
        <TableRangePicker
          range={dataRange}
          resolved={resolvedRange}
          onChange={onRangeChange}
        />
        {fullscreenPreferred && !focus && (
          <button className="sheet-restore-fullscreen" onClick={fullscreen}>
            Повернути повноекранний режим
          </button>
        )}
      </div>
      <div
        ref={scroller}
        onScroll={(e) => {
          writeWorkspace("scrollX", e.currentTarget.scrollLeft, account?.id);
          writeWorkspace("scrollY", e.currentTarget.scrollTop, account?.id);
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
                  className={`sheet-head-${c.key} ${pinnedOffsets.has(c.key) ? "sheet-pinned" : ""}`}
                  style={cellStyle(c.key)}
                  draggable={
                    ![
                      "number",
                      "comment",
                      "topCategory",
                      "score",
                      "status",
                    ].includes(c.key)
                  }
                  onDragStart={(e) => {
                    draggingColumn.current = c.key;
                    e.dataTransfer.setData("text/plain", c.key);
                  }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (draggingColumn.current)
                      reorderColumn(draggingColumn.current, c.key);
                    draggingColumn.current = null;
                  }}
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
                    {c.label}
                    {c.key !== "number" &&
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
                onClick={(e) => {
                  if (
                    !(e.target as HTMLElement).closest(".sheet-color-control")
                  )
                    selectTender(t);
                }}
                onDoubleClick={(e) => {
                  if (
                    (e.target as HTMLElement).closest(
                      "textarea, .sheet-cell-comment, a, .sheet-submission, .sheet-objects-preview, .sheet-detail-preview",
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
                onFocus={(e) => {
                  if (
                    !(e.target as HTMLElement).closest(".sheet-color-control")
                  )
                    selectTender(t);
                }}
              >
                {activeColumns.map((c) => (
                  <td
                    key={c.key}
                    style={cellStyle(c.key, t)}
                    className={`sheet-cell-${c.key} ${pinnedOffsets.has(c.key) ? "sheet-pinned" : ""}`}
                  >
                    {c.key === "number" ? (
                      index + 1
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
                    ) : c.key === "id" ? (
                      <a
                        className="sheet-id-link sheet-two-lines"
                        href={prozorro(t)}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={`Відкрити Prozorro: ${t.id}`}
                      >
                        {t.id}
                      </a>
                    ) : c.key === "objects" ? (
                      <ObjectsCell tender={t} zoom={zoom} />
                    ) : c.key === "score" &&
                      (t.analysisPending || t.aiScore === null) ? (
                      <span
                        title={
                          t.analysisPending
                            ? "AI аналіз ще не виконано"
                            : "AI score не визначено у mock-розборі"
                        }
                      >
                        -
                      </span>
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
                      <div className="sheet-comment-wrap">
                        <CommentPalette tender={t} />
                        {editingId === t.id ? (
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
                        )}
                      </div>
                    ) : c.key === "period" ? (
                      <SubmissionCell tender={t} now={now} zoom={zoom} />
                    ) : c.key === "budget" ? (
                      amount(t.budget, t.currency)
                    ) : c.key === "unitPrice" && t.unitPrice !== undefined ? (
                      amount(t.unitPrice, t.currency)
                    ) : (
                      <DetailCell
                        tender={t}
                        column={c.key}
                        now={now}
                        zoom={zoom}
                      />
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
          Показано {sorted.length} тендерів
          <small>Автозбереження · статус перераховується окремо</small>
        </span>
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
                    ["Сума", money(selected.budget, selected.currency)],
                    [
                      "Період",
                      `${shortDate(periodInfo(selected, now).start)} → ${selected.deadline.slice(0, 5)}`,
                    ],
                    ["Залишилось", periodInfo(selected, now).label],
                    ["Категорія", selected.topCategory],
                    [
                      "AI score",
                      selected.analysisPending || selected.aiScore === null
                        ? "-"
                        : `${selected.score}/100 · ${selected.priority}`,
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
