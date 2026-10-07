import { WorksheetImport } from "./worksheet-import";
import {
  defaultRange,
  validRange,
  resolveRange,
  inPublicationRange,
} from "@/lib/table-range";
import { useWorkspaceState } from "@/lib/workspace-state";
import { TenderCard } from "./tender-card";
import { useEffect, useRef, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  Plus,
  Upload,
  Play,
  Sparkles,
  ArrowRight,
  MoreHorizontal,
  FileText,
  FileSpreadsheet,
  File,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Download,
  RefreshCw,
  Search,
  ChevronRight,
  Eye,
  PenLine,
  Trash2,
  GripVertical,
  Truck,
  Package,
  Wrench,
  Factory,
  TrendingUp,
  UserRound,
  Mail,
  Phone,
  LogOut,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  AI,
  DemoButton,
  Empty,
  Metric,
  PageHead,
  Panel,
  Score,
  Status,
  TenderTable,
} from "./common";
import { managers, money, type Tender } from "@/lib/demo-data";
import {
  matchesStatus,
  normalizeStatus,
  statusLabel,
  statusOptions,
  isCompleted,
  kyivToday,
} from "@/lib/tender-workflow";
import { TenderWorksheet } from "./tender-worksheet";
import { categoryLabel, matchesRelevance } from "@/lib/worksheet-model";
import { tenderFlow } from "@/lib/tender-model";
import { useDemo } from "@/lib/demo-store";

export function Dashboard() {
  const { state } = useDemo();
  return (
    <section className="space-y-4">
      <h1>Робочий простір TenderPro</h1>
      <p>Імпортованих тендерів: {state.tenders.length}</p>
      <Link to="/tenders">Таблиця тендерів →</Link>
      <p>
        Excel → Agent 2 → Agent 3 → Agent 4. Робочі дані лише з імпорту та
        підтверджених джерел.
      </p>
    </section>
  );
}

export function Inbox({ importOnly = false }: { importOnly?: boolean }) {
  const [open, setOpen] = useState(importOnly);
  return (
    <section>
      <h1>Імпорт Excel</h1>
      <Button onClick={() => setOpen(true)}>Імпорт Excel</Button>
      <WorksheetImport open={open} onOpenChange={setOpen} />
    </section>
  );
}

export function Tenders() {
  const { state, now } = useDemo();
  const [filtersState, setFiltersState] = useWorkspaceState(
    "filters",
    {
      tab: "Усі",
      q: "",
      priority: "all",
      category: "all",
      budget: "all",
      date: "all",
      status: "all",
      relevance: "active",
    },
    (v) =>
      !!v &&
      typeof v === "object" &&
      ["tab", "q", "priority", "category", "budget", "date", "status"].every(
        (k) => typeof (v as Record<string, unknown>)[k] === "string",
      ),
  );
  const [dataRange, setDataRange] = useWorkspaceState(
    "dateRange",
    defaultRange,
    validRange,
  );
  const resolvedRange = resolveRange(dataRange, state.tenders, now);
  const { q, priority, category, budget, date, status } = filtersState;
  const relevance = filtersState.relevance ?? "active";
  const setFilter = (key: keyof typeof filtersState) => (value: string) =>
    setFiltersState((s) => ({ ...s, [key]: value }));
  const setQ = setFilter("q"),
    setPriority = setFilter("priority"),
    setCategory = setFilter("category"),
    setBudget = setFilter("budget"),
    setDate = setFilter("date"),
    setStatus = setFilter("status"),
    setRelevance = setFilter("relevance");
  const items = useMemo(
    () =>
      state.tenders
        .filter(
          (t) =>
            matchesRelevance(t, relevance) &&
            (priority === "all" || t.priority === priority) &&
            (category === "all" || categoryLabel(t) === category) &&
            (budget === "all" ||
              (budget === "small"
                ? t.budget < 5000000
                : budget === "medium"
                  ? t.budget >= 5000000 && t.budget < 15000000
                  : t.budget >= 15000000)) &&
            (status === "all" ||
              normalizeStatus(t.status) === normalizeStatus(status)) &&
            inPublicationRange(t, resolvedRange) &&
            matchesDeadline(t.deadline, date) &&
            `${t.id} ${t.title} ${t.customer}`
              .toLowerCase()
              .includes(q.toLowerCase()),
        )
        .sort((a, b) => b.score - a.score),
    [
      state.tenders,
      q,
      priority,
      category,
      budget,
      date,
      status,
      relevance,
      resolvedRange.from,
      resolvedRange.to,
      now,
    ],
  );
  return (
    <TenderWorksheet
      items={items}
      total={state.tenders.length}
      query={q}
      onQueryChange={setQ}
      details={(t) => tenderFlow(t)}
      dataRange={dataRange}
      resolvedRange={resolvedRange}
      onRangeChange={setDataRange}
      filters={
        <div className="sheet-filters">
          <Select value={relevance} onValueChange={setRelevance}>
            <SelectTrigger aria-label="Релевантність">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">
                Профільні / ще не оброблені
              </SelectItem>
              <SelectItem value="all">Усі, включно з відсіяними</SelectItem>
              <SelectItem value="rejected">Відсіяні mock-фільтром</SelectItem>
            </SelectContent>
          </Select>{" "}
          <Select value={priority} onValueChange={setPriority}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Всі пріоритети</SelectItem>
              <SelectItem value="A">Пріоритет A</SelectItem>
              <SelectItem value="B">Пріоритет B</SelectItem>
              <SelectItem value="C">Пріоритет C</SelectItem>
            </SelectContent>
          </Select>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Всі категорії</SelectItem>
              {[
                "Техніка",
                "Запчастини",
                "Будівництво",
                "Обладнання",
                "Матеріали",
                "Паливо",
                "Послуги",
                "Інше",
              ].map((x) => (
                <SelectItem key={x} value={x}>
                  {x}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={budget} onValueChange={setBudget}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Будь-який бюджет</SelectItem>
              <SelectItem value="small">До 5 млн</SelectItem>
              <SelectItem value="medium">5–15 млн</SelectItem>
              <SelectItem value="large">Від 15 млн</SelectItem>
            </SelectContent>
          </Select>
          <Select value={date} onValueChange={setDate}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Будь-який строк подання</SelectItem>
              <SelectItem value="week">Подання цього тижня</SelectItem>
              <SelectItem value="month">Подання цього місяця</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={status === "all" ? "all" : normalizeStatus(status)}
            onValueChange={setStatus}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Всі статуси</SelectItem>
              {statusOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                  {option.hint ? ` · ${option.hint}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      }
    />
  );
}

function matchesDeadline(deadline: string, range: string) {
  if (range === "all") return true;
  const now = new Date(kyivToday() + "T00:00:00Z");
  const [day, month, year] = deadline.split(".").map(Number);
  if (!day || !month || !year) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (range === "month")
    return (
      date >= now &&
      date.getUTCMonth() === now.getUTCMonth() &&
      date.getUTCFullYear() === now.getUTCFullYear()
    );
  const sunday = new Date(now);
  sunday.setUTCDate(sunday.getUTCDate() + ((7 - sunday.getUTCDay()) % 7));
  sunday.setUTCHours(23, 59, 59, 999);
  return date >= now && date <= sunday;
}

function CategoryIcon({ category }: { category: Tender["topCategory"] }) {
  const Icon =
    category === "Техніка"
      ? Truck
      : category === "Запчастини"
        ? Package
        : category === "Обладнання"
          ? Factory
          : Wrench;
  return (
    <span className="grid size-8 place-items-center rounded bg-secondary text-primary">
      <Icon className="size-4" />
    </span>
  );
}
function TenderGridTable({ items }: { items: Tender[] }) {
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th>Score</th>
            <th>Тендер</th>
            <th>Замовник</th>
            <th>Категорія</th>
            <th>Бюджет</th>
            <th>Дедлайн</th>
            <th>Priority</th>
            <th>Статус</th>
          </tr>
        </thead>
        <tbody>
          {items.map((t) => (
            <tr key={t.id}>
              <td>
                <Score value={t.score} />
              </td>
              <td>
                <Link
                  to="/tenders/$id"
                  params={{ id: t.id }}
                  className="flex min-w-64 items-center gap-3"
                >
                  <CategoryIcon category={t.topCategory} />
                  <span>
                    <b className="block text-foreground">{t.title}</b>
                    <small className="text-muted-foreground">{t.id}</small>
                  </span>
                </Link>
              </td>
              <td>{t.customer}</td>
              <td>
                <span className="text-xs font-medium">{t.topCategory}</span>
                <small className="block text-muted-foreground">
                  {t.category}
                </small>
              </td>
              <td className="whitespace-nowrap font-medium">
                {money(t.budget)}
              </td>
              <td>{t.deadline}</td>
              <td>
                <Status>{t.priority}</Status>
              </td>
              <td>
                <Status>{t.status}</Status>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function WorkingView({ items }: { items: Tender[] }) {
  const stages = [
    "Аналіз",
    "Прорахунок",
    "Уточнення",
    "Документи",
    "Подано",
    "Аукціон",
    "Завершено",
  ];
  return (
    <div className="mb-3 space-y-3">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="У роботі" value={String(items.length)} />
        <Metric
          label="Загальна сума"
          value={`${(items.reduce((a, t) => a + t.budget, 0) / 1000000).toFixed(1)} млн грн`}
        />
        <Metric
          label="Дедлайни цього тижня"
          value={String(
            items.filter((t) => matchesDeadline(t.deadline, "week")).length,
          )}
        />
        <Metric
          label="Менеджерів"
          value={String(
            new Set(
              items.filter((t) => t.manager !== "—").map((t) => t.manager),
            ).size,
          )}
        />
      </div>
      <Panel title="Етапи підготовки">
        <div className="grid gap-2 sm:grid-cols-5">
          {stages.map((s) => (
            <div key={s} className="rounded-md bg-muted p-3">
              <div className="flex justify-between text-xs">
                <span>{s}</span>
                <b>{items.filter((t) => t.stage === s).length}</b>
              </div>
              <Progress
                className="mt-2"
                value={Math.max(
                  8,
                  items.filter((t) => t.stage === s).length * 25,
                )}
              />
            </div>
          ))}
        </div>
      </Panel>
      <div className="grid gap-3 lg:grid-cols-2">
        {items.map((t) => {
          const m = managers.find((x) => x.name === t.manager);
          return (
            <Link
              key={t.id}
              to="/tenders/$id"
              params={{ id: t.id }}
              className="panel transition hover:-translate-y-0.5 hover:border-primary"
            >
              <div className="flex items-start justify-between">
                <div className="flex gap-3">
                  <CategoryIcon category={t.topCategory} />
                  <div>
                    <b className="text-sm">{t.title}</b>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t.customer}
                    </p>
                  </div>
                </div>
                <Score value={t.score} />
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
                <span>
                  <small className="block text-muted-foreground">Бюджет</small>
                  <b>{money(t.budget)}</b>
                </span>
                <span>
                  <small className="block text-muted-foreground">Дедлайн</small>
                  <b>{t.deadline}</b>
                </span>
                <span>
                  <small className="block text-muted-foreground">Етап</small>
                  <Status>{t.stage}</Status>
                </span>
              </div>
              <div className="mt-4 flex items-center gap-2 border-t pt-3">
                <span className="grid size-7 place-items-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                  {m?.initials ?? "—"}
                </span>
                <span className="text-xs">{t.manager}</span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export function TenderDetail({ id }: { id: string }) {
  const { state, viewTender, ready } = useDemo();
  useEffect(() => {
    if (ready) viewTender(id);
  }, [id, ready, viewTender]);
  const tender = state.tenders.find((t) => t.id === id);
  return tender ? (
    <TenderCard tender={tender} flow={tenderFlow(tender)} />
  ) : (
    <Empty text="Тендер не знайдено" />
  );
}

function Info({ rows }: { rows: (string | number)[][] }) {
  return (
    <dl>
      {rows.map((r) => (
        <div
          key={String(r[0])}
          className="grid grid-cols-[140px_1fr] gap-3 border-b py-3 text-sm"
        >
          <dt className="text-muted-foreground">{r[0]}</dt>
          <dd className="font-medium">{r[1]}</dd>
        </div>
      ))}
    </dl>
  );
}
function SpecPreview({
  parts = [],
}: {
  parts?: readonly import("@/lib/tender-detail").PartSpec[];
}) {
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th>Код</th>
            <th>Найменування</th>
            <th>Бренд</th>
            <th>К-ть</th>
          </tr>
        </thead>
        <tbody>
          {parts.map((s) => (
            <tr key={s.code}>
              <td>
                <b>{s.code}</b>
              </td>
              <td>{s.name}</td>
              <td>{s.brand}</td>
              <td>{s.qty} шт.</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function PricePreview({
  parts = [],
}: {
  parts?: readonly import("@/lib/tender-detail").PartSpec[];
}) {
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th>Позиція</th>
            <th>К-ть</th>
            <th>Ціна без ПДВ</th>
            <th>ПДВ</th>
            <th>Ціна з ПДВ</th>
            <th>Сума</th>
          </tr>
        </thead>
        <tbody>
          {parts.slice(0, 5).map((s, i) => {
            const price = [4200, 5800, 7600, 3900, 6200][i] ?? 0;
            return (
              <tr key={s.code}>
                <td>{s.code}</td>
                <td>{s.qty}</td>
                <td>{money(price)}</td>
                <td>20%</td>
                <td>{money(price * 1.2)}</td>
                <td>{money(price * 1.2 * s.qty)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
function AnalysisBlock({ title, text }: { title: string; text: string }) {
  return (
    <div className="my-4">
      <b className="text-sm">{title}</b>
      <p className="mt-1 text-sm leading-6 text-muted-foreground">{text}</p>
    </div>
  );
}
export function Pipeline() {
  const { state, setState } = useDemo();
  const cols = [
    "Аналіз",
    "Прорахунок",
    "Уточнення",
    "Документи",
    "Подано",
    "Аукціон",
    "Завершено",
  ];
  const getCol = (t: Tender, _i: number) =>
    cols.includes(t.stage) ? t.stage : "Аналіз";
  const move = (t: Tender) => {
    const current = getCol(t, state.tenders.indexOf(t));
    const next = cols[(cols.indexOf(current) + 1) % cols.length] || "Аналіз";
    setState((s) => ({
      ...s,
      pipeline: { ...s.pipeline, [t.id]: next },
      tenders: s.tenders.map((item) =>
        item.id === t.id ? { ...item, stage: next } : item,
      ),
    }));
    toast.success(`Переміщено: ${next}`);
  };
  return (
    <>
      <PageHead
        title="Тендери в роботі"
        description="Керуйте етапами підготовки тендерних пропозицій"
      />
      <div className="flex gap-3 overflow-x-auto pb-4">
        {cols.map((c) => (
          <section key={c} className="kanban-col">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span>{c}</span>
              <span className="rounded-full bg-card px-2 py-0.5">
                {
                  state.tenders
                    .filter((t) => matchesStatus(t, "В роботі"))
                    .filter((t, i) => getCol(t, i) === c).length
                }
              </span>
            </div>
            {state.tenders
              .filter((t) => matchesStatus(t, "В роботі"))
              .map(
                (t, i) =>
                  getCol(t, i) === c && (
                    <article className="kanban-card" key={t.id}>
                      <div className="flex justify-between">
                        <Score value={t.score} />
                        <GripVertical className="size-4 text-muted-foreground" />
                      </div>
                      <Link
                        to="/tenders/$id"
                        params={{ id: t.id }}
                        className="mt-3 block text-sm font-semibold hover:text-primary"
                      >
                        {t.title}
                      </Link>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {money(t.budget)} · {t.deadline}
                      </p>
                      <div className="mt-3 flex items-center justify-between">
                        <span className="text-[11px]">{t.manager}</span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => move(t)}
                        >
                          Перемістити
                        </Button>
                      </div>
                    </article>
                  ),
              )}
          </section>
        ))}
      </div>
    </>
  );
}
export function Categories() {
  const [selected, setSelected] = useState("Запчастини");
  const [dialog, setDialog] = useState(false);
  const tree = [
    [
      "Запчастини",
      ["XCMG", "Фільтри", "Двигуни", "Гідравліка", "Залізничні запчастини"],
    ],
    ["Обладнання", ["Бурове", "Гірниче", "Компресорне"]],
    ["Сервіс і роботи", []],
    ["Нова гілка", []],
  ] as const;
  return (
    <>
      <PageHead
        title="Категорії"
        description="Структура напрямів для класифікації та AI-аналізу"
        actions={
          <Button onClick={() => setDialog(true)}>
            <Plus />
            Додати категорію
          </Button>
        }
      />
      <div className="grid gap-3 lg:grid-cols-[1fr_.8fr]">
        <Panel title="Дерево категорій">
          <div className="space-y-2">
            {tree.map(([root, children]) => (
              <div key={root}>
                <button
                  onClick={() => setSelected(root)}
                  className={`flex w-full items-center rounded-md p-2 text-sm font-semibold ${selected === root ? "bg-accent text-accent-foreground" : "hover:bg-muted"}`}
                >
                  <ChevronRight className="mr-2 size-4" />
                  {root}
                </button>
                <div className="ml-7 border-l pl-2">
                  {children.map((x) => (
                    <button
                      key={x}
                      onClick={() => setSelected(x)}
                      className={`flex w-full items-center rounded p-2 text-left text-sm ${selected === x ? "bg-accent text-accent-foreground" : "hover:bg-muted"}`}
                    >
                      {x}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Panel>
        <Panel title={selected}>
          <div className="grid grid-cols-2 gap-3">
            <Metric label="Тендерів за 30 днів" value="48" trend="+12%" />
            <Metric label="Сума закупівель" value="32,4 млн" />
            <Metric label="Середній score" value="81" />
            <Metric label="Конверсія" value="18,5%" />
          </div>
          <div className="mt-5 flex gap-2">
            <Button variant="outline" onClick={() => setDialog(true)}>
              <PenLine />
              Редагувати
            </Button>
            <DemoButton variant="outline" result="Категорію приховано">
              <Eye />
              Приховати
            </DemoButton>
          </div>
        </Panel>
      </div>
      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Категорія</DialogTitle>
            <DialogDescription>
              Створіть нову або змініть вибрану категорію
            </DialogDescription>
          </DialogHeader>
          <input className="field" defaultValue={selected} />
          <DialogFooter>
            <Button
              onClick={() => {
                setDialog(false);
                toast.success("Категорію збережено");
              }}
            >
              Зберегти
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
export function Rules() {
  const { state, setState } = useDemo();
  const total =
    50 + state.rules.filter((r) => r.enabled).reduce((a, r) => a + r.weight, 0);
  return (
    <>
      <PageHead
        title="Правила аналізу"
        description="Налаштуйте ваги, які формують AI score"
        actions={
          <Button
            onClick={() =>
              setState((s) => ({
                ...s,
                rules: [
                  ...s.rules,
                  { name: "Нове правило", weight: 10, enabled: true },
                ],
              }))
            }
          >
            <Plus />
            Додати правило
          </Button>
        }
      />
      <div className="grid gap-3 lg:grid-cols-[1.3fr_.7fr]">
        <Panel title="Активні правила">
          <div className="space-y-2">
            {state.rules.map((r, i) => (
              <div
                key={i}
                className="grid grid-cols-[24px_1fr_90px_40px] items-center gap-3 rounded-md border p-3"
              >
                <GripVertical className="size-4 text-muted-foreground" />
                <input
                  className="field"
                  value={r.name}
                  onChange={(e) =>
                    setState((s) => ({
                      ...s,
                      rules: s.rules.map((x, j) =>
                        j === i ? { ...x, name: e.target.value } : x,
                      ),
                    }))
                  }
                />
                <input
                  className="field text-center"
                  type="number"
                  value={r.weight}
                  onChange={(e) =>
                    setState((s) => ({
                      ...s,
                      rules: s.rules.map((x, j) =>
                        j === i ? { ...x, weight: Number(e.target.value) } : x,
                      ),
                    }))
                  }
                />
                <Switch
                  checked={r.enabled}
                  onCheckedChange={(v) =>
                    setState((s) => ({
                      ...s,
                      rules: s.rules.map((x, j) =>
                        j === i ? { ...x, enabled: v } : x,
                      ),
                    }))
                  }
                />
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="Live preview">
          <p className="text-sm text-muted-foreground">
            Тестовий тендер: Запчастини XCMG
          </p>
          <div className="my-6 text-center">
            <div className="mx-auto grid size-28 place-items-center rounded-full border-8 border-primary/20 text-3xl font-bold text-primary">
              {Math.max(0, Math.min(100, total))}
            </div>
            <p className="mt-3 text-sm">Очікуваний AI score</p>
          </div>
          <p className="rounded bg-muted p-3 text-xs">
            Зміни ваг застосовуються миттєво та зберігаються у цьому браузері.
          </p>
        </Panel>
      </div>
    </>
  );
}
const customers = [
  ["Київський метрополітен", 18, "34,2 млн"],
  ["Укрзалізниця", 42, "128,7 млн"],
  ["Київводоканал", 12, "21,4 млн"],
  ["ДП «Антонов»", 9, "44,1 млн"],
  ["Укргазвидобування", 31, "89,5 млн"],
  ["Енергоатом", 27, "116,2 млн"],
  ["Харківпастранс", 8, "14,8 млн"],
];
export function Customers() {
  const [selected, setSelected] = useState<(typeof customers)[number] | null>(
    null,
  );
  return (
    <>
      <PageHead
        title="Замовники"
        description="Історія закупівель та взаємодій із ключовими організаціями"
      />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {customers.map((c) => (
          <button
            key={c[0]}
            onClick={() => setSelected(c)}
            className="panel text-left transition hover:-translate-y-0.5 hover:border-primary"
          >
            <div className="flex items-start justify-between">
              <div className="grid size-10 place-items-center rounded-md bg-secondary font-bold text-primary">
                {String(c[0]).slice(0, 2).toUpperCase()}
              </div>
              <MoreHorizontal className="size-4" />
            </div>
            <h3 className="mt-4 font-semibold">{c[0]}</h3>
            <div className="mt-4 flex gap-6 text-sm">
              <span>
                <b>{c[1]}</b>
                <small className="block text-muted-foreground">тендерів</small>
              </span>
              <span>
                <b>{c[2]}</b>
                <small className="block text-muted-foreground">
                  загальна сума
                </small>
              </span>
            </div>
          </button>
        ))}
      </div>
      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-w-2xl">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle>{selected[0]}</DialogTitle>
                <DialogDescription>
                  {selected[1]} закупівель на {selected[2]}
                </DialogDescription>
              </DialogHeader>
              <Info
                rows={[
                  ["Категорії", "Запчастини, обладнання, сервіс"],
                  ["Остання закупівля", "Фільтруючі елементи · 04.09.2026"],
                  ["Наша історія", "3 пропозиції · 1 перемога"],
                  [
                    "Примітки",
                    "Швидко відповідає на уточнення; уважно до строків",
                  ],
                ]}
              />
              <Textarea placeholder="Додати примітку…" />
              <Button onClick={() => toast.success("Примітку збережено")}>
                Зберегти примітку
              </Button>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
const months = [
  { m: "Кві", v: 86 },
  { m: "Тра", v: 102 },
  { m: "Чер", v: 119 },
  { m: "Лип", v: 140 },
  { m: "Сер", v: 156 },
  { m: "Вер", v: 182 },
];
export function Analytics() {
  return (
    <>
      <PageHead
        title="Аналітика"
        description="Динаміка тендерів, конверсія та ефективність команди"
        actions={
          <Select defaultValue="6">
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="3">Останні 3 місяці</SelectItem>
              <SelectItem value="6">Останні 6 місяців</SelectItem>
              <SelectItem value="12">Останній рік</SelectItem>
            </SelectContent>
          </Select>
        }
      />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Сума в роботі" value="24,8 млн грн" trend="+8,2%" />
        <Metric label="Конверсія" value="18,5%" trend="+2,1 п.п." />
        <Metric label="Виграно / програно" value="11 / 7" />
        <Metric label="Середній score" value="76,4" trend="+4,6" />
      </div>
      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <Panel title="Тендери за місяцями">
          <div className="h-72">
            <ResponsiveContainer>
              <AreaChart data={months}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="m" />
                <YAxis />
                <Tooltip />
                <Area
                  dataKey="v"
                  stroke="var(--primary)"
                  fill="var(--accent)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel title="Конверсія за етапами">
          <div className="h-72">
            <ResponsiveContainer>
              <BarChart
                data={[
                  { n: "Вхідні", v: 182 },
                  { n: "Релевантні", v: 37 },
                  { n: "В роботі", v: 12 },
                  { n: "Подано", v: 8 },
                  { n: "Виграно", v: 3 },
                ]}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="n" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="v" fill="var(--primary)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel title="Топ категорій">
          <ChartList
            rows={[
              ["Запчастини", 34],
              ["Обладнання", 27],
              ["Фільтри", 19],
              ["Сервіс", 12],
            ]}
          />
        </Panel>
        <Panel title="Топ замовників">
          <ChartList
            rows={[
              ["Укрзалізниця", 42],
              ["Укргазвидобування", 31],
              ["Енергоатом", 27],
              ["Київський метрополітен", 18],
            ]}
          />
        </Panel>
      </div>
    </>
  );
}
function ChartList({ rows }: { rows: [string, number][] }) {
  return (
    <div className="space-y-4">
      {rows.map(([x, v]) => (
        <div key={x}>
          <div className="mb-1 flex justify-between text-sm">
            <span>{x}</span>
            <b>{v}</b>
          </div>
          <Progress value={v * 2} />
        </div>
      ))}
    </div>
  );
}
export function ExportPage() {
  const { state } = useDemo();
  return (
    <section>
      <h1>Експорт</h1>
      <p>Тендерів у робочій таблиці: {state.tenders.length}</p>
      <Link to="/tenders">Експортувати поточний вигляд у таблиці →</Link>
    </section>
  );
}

export function Knowledge() {
  const { state, setState } = useDemo();
  const form = state.knowledge;
  const setForm = (knowledge: typeof form) =>
    setState((s) => ({ ...s, knowledge }));
  const fields = [
    ["company", "Профіль компанії"],
    ["brands", "Бренди"],
    ["groups", "Товарні групи"],
    ["no", "Що НЕ цікаво"],
    ["regions", "Регіони"],
    ["terms", "Типові строки поставки"],
    ["margin", "Мінімальна маржа"],
    ["strengths", "Наші сильні сторони"],
    ["certs", "Досвід та сертифікати"],
  ] as const;
  return (
    <>
      <PageHead
        title="База знань AI"
        description="Контекст, на основі якого TenderPro оцінює закупівлі"
        actions={
          <Button onClick={() => toast.success("AI-профіль перегенеровано")}>
            <Sparkles />
            Перегенерувати профіль
          </Button>
        }
      />
      <div className="grid gap-3 lg:grid-cols-[1.2fr_.8fr]">
        <Panel title="Знання про компанію">
          <div className="grid gap-4 md:grid-cols-2">
            {fields.map(([k, l]) => (
              <label key={k} className="text-xs font-semibold">
                {l}
                <Textarea
                  className="mt-1 min-h-20 font-normal"
                  value={form[k]}
                  onChange={(e) => setForm({ ...form, [k]: e.target.value })}
                />
              </label>
            ))}
          </div>
        </Panel>
        <Panel
          title="Як AI бачить компанію"
          className="h-fit lg:sticky lg:top-20"
        >
          <AI>Згенерований профіль</AI>
          <p className="mt-4 text-sm leading-7">
            Компанія спеціалізується на {form.groups.toLowerCase()} та працює з
            брендами {form.brands}. Ключові переваги:{" "}
            {form.strengths.toLowerCase()}.
          </p>
          <p className="mt-3 text-sm leading-7">
            Пріоритетні регіони: {form.regions}. Мінімальна очікувана маржа —{" "}
            {form.margin}. Не рекомендувати: {form.no.toLowerCase()}.
          </p>
        </Panel>
      </div>
    </>
  );
}
export function ProfilePage() {
  return (
    <>
      <PageHead
        title="Профіль"
        description="Особисті дані та роль у команді TenderPro"
      />
      <Panel title="Влад Михайлов">
        <Info
          rows={[
            ["Роль", "Адміністратор"],
            ["Компанія", "ТОВ «ТехПром Постач»"],
            ["Режим", "Alpha demo"],
          ]}
        />
        <div className="mt-4 flex gap-2">
          <DemoButton result="Редагування профілю: демо-режим">
            Редагувати профіль
          </DemoButton>
          <Button asChild variant="outline">
            <Link to="/settings">Налаштування компанії</Link>
          </Button>
        </div>
      </Panel>
    </>
  );
}

export function SettingsPage() {
  const { state, setState } = useDemo();
  const set = (k: string, v: boolean) =>
    setState((s) => ({ ...s, settings: { ...s.settings, [k]: v } }));
  return (
    <>
      <PageHead
        title="Налаштування"
        description="Керування компанією, AI та демо-інтеграціями"
      />
      <Tabs defaultValue="company">
        <TabsList className="mb-3">
          <TabsTrigger value="company">Компанія</TabsTrigger>
          <TabsTrigger value="users">Користувачі</TabsTrigger>
          <TabsTrigger value="ai">AI</TabsTrigger>
          <TabsTrigger value="integrations">Інтеграції</TabsTrigger>
          <TabsTrigger value="notify">Сповіщення</TabsTrigger>
          <TabsTrigger value="plan">Тариф</TabsTrigger>
        </TabsList>
        <TabsContent value="company">
          <Panel title="Компанія">
            <Info
              rows={[
                ["Назва", "ТОВ «ТехПром Постач»"],
                ["ЄДРПОУ", "41234567"],
                ["Місто", "Київ"],
                ["Контакт", "Влад Михайлов"],
              ]}
            />
            <DemoButton>Редагувати</DemoButton>
          </Panel>
        </TabsContent>
        <TabsContent value="users">
          <Panel title="Користувачі">
            <Info
              rows={[
                ["Влад Михайлов", "Адміністратор"],
                ["Ірина Коваль", "Тендерний менеджер"],
                ["Олег Савчук", "Керівник продажів"],
                ["Анна Бойко", "Аналітик"],
              ]}
            />
            <DemoButton>
              <Plus />
              Запросити користувача
            </DemoButton>
          </Panel>
        </TabsContent>
        <TabsContent value="ai">
          <Tabs defaultValue="mode">
            <TabsList className="mb-3">
              <TabsTrigger value="mode">Режим AI</TabsTrigger>
              <TabsTrigger value="rules">Правила аналізу</TabsTrigger>
              <TabsTrigger value="knowledge">
                Профіль компанії для AI
              </TabsTrigger>
            </TabsList>
            <TabsContent value="rules">
              <Rules />
            </TabsContent>
            <TabsContent value="knowledge">
              <Knowledge />
            </TabsContent>
            <TabsContent value="mode">
              <Panel title="Режим AI">
                <ToggleRow
                  label="Автоматичний аналіз нових тендерів"
                  checked={state.settings["autoAI"] ?? false}
                  onChange={(v) => set("autoAI", v)}
                />
                <ToggleRow
                  label="Швидкий аналіз"
                  checked={state.settings["fast"] ?? false}
                  onChange={(v) => set("fast", v)}
                />
                <ToggleRow
                  label="Повний аналіз документів"
                  checked={state.settings["full"] ?? false}
                  onChange={(v) => set("full", v)}
                />
                <div className="mt-6 rounded-md bg-muted p-4">
                  <div className="flex justify-between text-sm">
                    <span>Використання AI у жовтні</span>
                    <b>3 420 / 10 000</b>
                  </div>
                  <Progress value={34} className="mt-2" />
                  <p className="mt-2 text-xs text-muted-foreground">
                    Демо-індикатор внутрішнього використання
                  </p>
                </div>
              </Panel>
            </TabsContent>
          </Tabs>
        </TabsContent>
        <TabsContent value="integrations">
          <Panel title="Інтеграції">
            <div className="space-y-2">
              {[
                ["Prozorro", "Не підключено"],
                ["Telegram", "Не підключено"],
              ].map((x) => (
                <div
                  key={x[0]}
                  className="flex items-center gap-4 rounded-md border p-4"
                >
                  <div className="grid size-10 place-items-center rounded bg-muted font-bold">
                    {String(x[0]).charAt(0)}
                  </div>
                  <div className="flex-1">
                    <b className="text-sm">{x[0]}</b>
                    <p className="text-xs text-muted-foreground">{x[1]}</p>
                  </div>
                  <DemoButton
                    variant="outline"
                    result={`Налаштування ${x[0]} збережено`}
                  >
                    Підключити
                  </DemoButton>
                </div>
              ))}
            </div>
          </Panel>
        </TabsContent>
        <TabsContent value="notify">
          <Panel title="Сповіщення">
            <ToggleRow
              label="Новий тендер Priority A"
              checked={state.settings["notifyPriority"] ?? true}
              onChange={(v) => set("notifyPriority", v)}
            />
            <ToggleRow
              label="Дедлайн менше 3 днів"
              checked={true}
              onChange={() => toast.success("Налаштування збережено")}
            />
            <ToggleRow
              label="Зміни в документації"
              checked={state.settings["notifyDocuments"] ?? false}
              onChange={(v) => set("notifyDocuments", v)}
            />
          </Panel>
        </TabsContent>
        <TabsContent value="plan">
          <Panel title="Business">
            <div className="text-3xl font-bold">
              $299
              <span className="text-sm font-normal text-muted-foreground">
                /міс
              </span>
            </div>
            <ul className="my-5 space-y-2 text-sm">
              <li>✓ AI-аналіз включено</li>
              <li>✓ До 5 користувачів</li>
              <li>✓ Необмежені тендери</li>
              <li>✓ Експорт та аналітика</li>
            </ul>
            <DemoButton>Керувати тарифом</DemoButton>
          </Panel>
        </TabsContent>
      </Tabs>
    </>
  );
}
function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between border-b py-4 text-sm">
      <span>{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
