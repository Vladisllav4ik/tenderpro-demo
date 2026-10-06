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
import { managers, money, tenders as seed, type Tender } from "@/lib/demo-data";
import { detailFlow } from "@/lib/tender-detail";
import { useDemo } from "@/lib/demo-store";

export function Dashboard() {
  const { state } = useDemo();
  const working = state.tenders.filter((t) => t.status === "В роботі");
  const workingBudget = money(working.reduce((sum, t) => sum + t.budget, 0));
  const kpis = [
    ["Нові тендери сьогодні", "182", "+14%"],
    ["Релевантні", "37", "20,3% від вхідних"],
    ["Пріоритет A", "12", "Висока відповідність"],
    ["В роботі", String(working.length), workingBudget],
  ];
  return (
    <>
      <PageHead
        title="Головна"
        description="Оперативна картина тендерного портфеля на сьогодні"
        actions={
          <DemoButton result="Дані оновлено">
            <RefreshCw />
            Оновити
          </DemoButton>
        }
      />
      <div className="mb-3 flex flex-col gap-4 rounded-lg border border-ai/25 bg-ai/10 p-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-md bg-ai text-primary-foreground">
            <Sparkles className="size-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-semibold">Показати демо-сценарій</h2>
              <AI>Showcase</AI>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Потік/Excel → AI-скринінг → аналіз → сортування → рішення → В
              роботу
            </p>
          </div>
        </div>
        <Button asChild>
          <Link to="/tenders/$id" params={{ id: "UA-2026-08-25-006722-a" }}>
            Відкрити showcase-тендер
            <ArrowRight />
          </Link>
        </Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((k, i) => (
          <Link
            key={k[0]}
            to="/tenders"
            className="metric transition hover:-translate-y-0.5 hover:border-primary"
          >
            <span className="text-xs text-muted-foreground">{k[0]}</span>
            <strong className="mt-2 block text-2xl">{k[1]}</strong>
            <span className="mt-1 block text-xs text-success">{k[2]}</span>
          </Link>
        ))}
      </div>
      <div className="mt-3 grid gap-3 lg:grid-cols-[1.45fr_.8fr]">
        <Panel title="Воронка тендерів">
          <div className="grid grid-cols-4 gap-2">
            {[
              ["Отримано", 182],
              ["Релевантні", 37],
              ["Priority A", 12],
              ["В роботі", working.length],
            ].map(([l, v], i) => (
              <div key={String(l)} className="relative rounded-md bg-muted p-3">
                <div className="text-xl font-semibold">{v}</div>
                <div className="text-xs text-muted-foreground">{l}</div>
                {i < 3 && (
                  <ArrowRight className="absolute -right-3 top-5 z-10 size-4 text-primary" />
                )}
              </div>
            ))}
          </div>
          <div className="mt-4 flex gap-6 border-t pt-4 text-sm">
            <span>
              <b>7</b> дедлайн ≤ 3 днів
            </span>
            <span>
              <b>{workingBudget}</b> у роботі
            </span>
          </div>
        </Panel>
        <Panel title="AI-зведення">
          <div className="flex items-center gap-3">
            <div className="grid size-12 place-items-center rounded-md bg-ai/10 text-ai">
              <Sparkles />
            </div>
            <div>
              <b className="text-2xl">82%</b>
              <p className="text-xs text-muted-foreground">
                точність рекомендацій
              </p>
            </div>
          </div>
          <Progress value={82} className="mt-4" />
        </Panel>
      </div>
      <div className="mt-3 grid gap-3 lg:grid-cols-3">
        <Panel title="Пріоритети A / B / C">
          <div className="flex h-48 items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={[
                    { name: "A", value: 9 },
                    { name: "B", value: 5 },
                    { name: "C", value: 3 },
                  ]}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={48}
                  outerRadius={72}
                  paddingAngle={3}
                >
                  {["var(--success)", "var(--warning)", "var(--danger)"].map(
                    (color) => (
                      <Cell key={color} fill={color} />
                    ),
                  )}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute text-center">
              <b className="text-xl">17</b>
              <p className="text-[10px] text-muted-foreground">тендерів</p>
            </div>
          </div>
          <div className="flex justify-center gap-4 text-xs">
            <span className="text-success">● A — 9</span>
            <span className="text-warning">● B — 5</span>
            <span className="text-danger">● C — 3</span>
          </div>
        </Panel>
        <Panel title="Категорії">
          <div className="space-y-4">
            {(
              [
                ["Техніка", 78, Truck],
                ["Запчастини", 64, Package],
                ["Обладнання", 42, Factory],
                ["Сервіс", 28, Wrench],
              ] as const
            ).map(([label, value, Icon]) => (
              <div key={String(label)}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="flex items-center gap-2">
                    <Icon className="size-4 text-primary" />
                    {String(label)}
                  </span>
                  <b>{String(value)}</b>
                </div>
                <Progress value={Number(value)} />
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="Динаміка надходжень">
          <div className="mb-3 flex gap-2">
            <Status>7 днів</Status>
            <span className="text-xs text-muted-foreground">30 днів: +18%</span>
          </div>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={[12, 18, 15, 24, 21, 31, 37].map((v, i) => ({
                  d: i + 1,
                  v,
                }))}
              >
                <Area dataKey="v" stroke="var(--ai)" fill="var(--accent)" />
                <Tooltip />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>
      <div className="mt-3 grid gap-3 xl:grid-cols-[1fr_1.4fr]">
        <Panel title="Рекомендації AI">
          <div className="space-y-2">
            {[
              [
                "Автокран XCMG",
                "Score 93 · перевірити сервіс та гарантію",
                "UA-2026-09-29-003902-a",
              ],
              [
                "Самоскиди DONGFENG",
                "Score 94 · брати в роботу",
                "UA-2026-10-02-004811-a",
              ],
              [
                "Фільтри до тепловозів",
                "Запросити сумісність LF9009",
                "UA-2026-08-25-006722-a",
              ],
            ].map((x) => (
              <Link
                to="/tenders/$id"
                params={{ id: x[2]! }}
                key={x[0]}
                className="flex items-center gap-3 rounded-md border p-3 transition hover:bg-muted"
              >
                <AI />
                <div className="flex-1 text-sm">
                  <b>{x[0]}</b>
                  <p className="text-xs text-muted-foreground">{x[1]}</p>
                </div>
                <ChevronRight className="size-4" />
              </Link>
            ))}
          </div>
        </Panel>
        <Panel title="Тендери в роботі">
          <div className="grid gap-2 sm:grid-cols-3">
            {state.tenders
              .filter((t) => t.status === "В роботі")
              .slice(0, 5)
              .map((t, i) => (
                <div key={t.id} className="rounded-md border p-3">
                  <Status>{t.stage}</Status>
                  <Link
                    to="/tenders/$id"
                    params={{ id: t.id }}
                    className="mt-2 block text-sm font-semibold hover:text-primary"
                  >
                    {t.title}
                  </Link>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {money(t.budget)}
                  </p>
                </div>
              ))}
          </div>
        </Panel>
      </div>
      <Panel title="Останні тендери" className="mt-3">
        <TenderTable items={state.tenders.slice(0, 6)} compact />
      </Panel>
    </>
  );
}

export function Inbox({ importOnly = false }: { importOnly?: boolean }) {
  const { state, setState, updateTender } = useDemo();
  const [filter, setFilter] = useState("Усі");
  const [progress, setProgress] = useState(0);
  const [running, setRunning] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importStep, setImportStep] = useState(1);
  const [demoFile, setDemoFile] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearInterval(timer.current);
    },
    [],
  );
  const run = () => {
    if (timer.current) return;
    setRunning(true);
    setProgress(0);
    let completed = 0;
    timer.current = setInterval(() => {
      completed = Math.min(100, completed + 10);
      setProgress(completed);
      if (completed === 100) {
        if (timer.current) clearInterval(timer.current);
        timer.current = null;
        setRunning(false);
        setState((s) => ({
          ...s,
          tenders: s.tenders.map((t) =>
            t.status === "Новий" ? { ...t, status: "Проаналізовано" } : t,
          ),
        }));
        toast.success("AI-скринінг завершено", {
          description: "Демонстраційна оцінка за профілем компанії",
        });
      }
    }, 90);
  };
  const items =
    filter === "Усі"
      ? state.tenders
      : state.tenders.filter((t) => t.status === filter);
  const importDialog = (
    <Dialog
      open={importOpen}
      onOpenChange={(open) => {
        setImportOpen(open);
        if (open) {
          setImportStep(1);
          setDemoFile(false);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline">
          <Upload />
          Імпорт Excel
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Імпорт Excel</DialogTitle>
          <DialogDescription>
            Три кроки від файлу до готових тендерів
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-3 gap-2">
          {["Файл", "Мапінг", "Результат"].map((label, i) => (
            <div
              key={label}
              className={`rounded-md border px-3 py-2 text-xs font-semibold ${importStep === i + 1 ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground"}`}
            >
              <span className="mr-2">{i + 1}</span>
              {label}
            </div>
          ))}
        </div>
        {importStep === 1 && (
          <div className="grid min-h-48 place-items-center rounded-md border border-dashed bg-muted p-6 text-sm text-muted-foreground">
            <div className="text-center">
              <Upload className="mx-auto mb-3 size-8" />
              {demoFile ? (
                <>
                  <b className="block text-foreground">
                    subscription_2026_demo.xlsx
                  </b>
                  <span>3 демонстраційні рядки · 10 колонок</span>
                </>
              ) : (
                <>
                  <span className="block">Демонстраційний імпорт Excel</span>
                  <Button
                    className="mt-4"
                    variant="outline"
                    onClick={() => setDemoFile(true)}
                  >
                    Використати демо-файл
                  </Button>
                </>
              )}
            </div>
          </div>
        )}
        {importStep === 2 && (
          <div className="max-h-[420px] overflow-auto rounded-md border">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Колонка Excel</th>
                  <th>Поле TenderPro</th>
                  <th>Статус</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["ID", "ID тендера"],
                  ["Посилання", "URL"],
                  ["Предмет закупівлі", "Назва"],
                  ["CPV", "CPV"],
                  ["Очікувана вартість", "Бюджет"],
                  ["Замовник", "Замовник"],
                  ["Регіон", "Регіон"],
                  ["Прийом пропозицій до", "Дедлайн"],
                  ["Строк поставки", "Поставка"],
                  ["Умови оплати", "Оплата"],
                ].map(([source, target]) => (
                  <tr key={source}>
                    <td className="font-medium">{source}</td>
                    <td>
                      <Select defaultValue={target ?? ""}>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={target ?? ""}>{target}</SelectItem>
                          <SelectItem value="skip">Не імпортувати</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                    <td>
                      <Status>Зіставлено</Status>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {importStep === 3 && (
          <div>
            <div className="grid gap-3 sm:grid-cols-4">
              <Metric label="Рядки прочитано" value="3" />
              <Metric
                label="Нові тендери"
                value={String(
                  seed
                    .slice(3, 6)
                    .filter(
                      (item) =>
                        !state.tenders.some((t) => t.id === item.id + "-IMP"),
                    ).length,
                )}
              />
              <Metric
                label="Дублікати"
                value={String(
                  seed
                    .slice(3, 6)
                    .filter((item) =>
                      state.tenders.some((t) => t.id === item.id + "-IMP"),
                    ).length,
                )}
              />
              <Metric label="Перевірити" value="0" />
            </div>
            <div className="mt-4 rounded-md bg-ai/10 p-4 text-sm">
              <AI>AI</AI>
              <span className="ml-2">
                Структуру файлу розпізнано. Усі обов’язкові поля зіставлено.
              </span>
            </div>
          </div>
        )}
        <DialogFooter>
          {importStep > 1 && (
            <Button
              variant="outline"
              onClick={() => setImportStep((s) => s - 1)}
            >
              Назад
            </Button>
          )}
          {importStep < 3 ? (
            <Button
              disabled={importStep === 1 && !demoFile}
              onClick={() => setImportStep((s) => s + 1)}
            >
              Далі
              <ArrowRight />
            </Button>
          ) : (
            <Button
              onClick={() => {
                const extra = seed.slice(3, 6).map((t) => ({
                  ...t,
                  id: t.id + "-IMP",
                  status: "Новий",
                  manager: "—",
                  stage: "Аналіз",
                }));
                setState((s) => ({
                  ...s,
                  tenders: [
                    ...extra.filter(
                      (item) => !s.tenders.some((t) => t.id === item.id),
                    ),
                    ...s.tenders,
                  ],
                }));
                setImportOpen(false);
                setImportStep(1);
                setDemoFile(false);
                toast.success("Демо-імпорт завершено", {
                  description:
                    "Додано нові показові рядки; дублікати пропущено",
                });
              }}
            >
              Імпортувати 3 демо-тендери
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
  if (importOnly)
    return (
      <>
        {importDialog}
        <Button onClick={run} disabled={running}>
          <Sparkles />
          {running ? `Аналізуємо… ${progress}%` : "Запустити AI-скринінг"}
        </Button>
      </>
    );
  return (
    <>
      <PageHead
        title="Вхідні тендери"
        description="Нові закупівлі для первинного відбору та AI-скринінгу"
        actions={
          <div className="flex flex-wrap gap-2">
            {importDialog}
            <DemoButton>
              <Plus />
              Додати тендер
            </DemoButton>
            <Button onClick={run} disabled={running}>
              <Sparkles />
              {running ? "Аналізуємо…" : "Запустити AI-скринінг"}
            </Button>
          </div>
        }
      />
      {running && (
        <Panel className="mb-3">
          <div className="mb-2 flex justify-between text-sm">
            <span>AI аналізує тендери та документи</span>
            <b>{progress}%</b>
          </div>
          <Progress value={progress} />
        </Panel>
      )}
      <Panel>
        <div className="mb-4 flex flex-wrap gap-2">
          {[
            "Усі",
            "Новий",
            "На аналізі",
            "Проаналізовано",
            "Ручний перегляд",
          ].map((f) => (
            <Button
              key={f}
              size="sm"
              variant={filter === f ? "default" : "outline"}
              onClick={() => setFilter(f)}
            >
              {f}
            </Button>
          ))}
        </div>
        {items.length ? (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Score</th>
                  <th>Тендер</th>
                  <th>Замовник</th>
                  <th>Бюджет</th>
                  <th>Статус</th>
                  <th>Дії</th>
                </tr>
              </thead>
              <tbody>
                {items.map((t) => (
                  <tr key={t.id}>
                    <td>
                      <Score value={t.score} />
                    </td>
                    <td>
                      <b>{t.title}</b>
                      <div className="text-[11px] text-muted-foreground">
                        {t.id}
                      </div>
                    </td>
                    <td>{t.customer}</td>
                    <td>{money(t.budget)}</td>
                    <td>
                      <Status>{t.status}</Status>
                    </td>
                    <td>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            updateTender(t.id, "Проаналізовано");
                            toast.success("Швидкий аналіз завершено");
                          }}
                        >
                          AI
                        </Button>
                        <Button size="sm" variant="ghost" asChild>
                          <Link to="/tenders/$id" params={{ id: t.id }}>
                            Відкрити
                          </Link>
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => updateTender(t.id, "Відхилено")}
                        >
                          Відхилити
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty />
        )}
      </Panel>
    </>
  );
}

export function Tenders() {
  const { state } = useDemo();
  const [tab, setTab] = useState("Усі");
  const [q, setQ] = useState("");
  const [priority, setPriority] = useState("all");
  const [category, setCategory] = useState("all");
  const [budget, setBudget] = useState("all");
  const [date, setDate] = useState("all");
  const [status, setStatus] = useState("all");
  const items = useMemo(
    () =>
      state.tenders
        .filter(
          (t) =>
            (priority === "all" || t.priority === priority) &&
            (category === "all" || t.topCategory === category) &&
            (budget === "all" ||
              (budget === "small"
                ? t.budget < 5000000
                : budget === "medium"
                  ? t.budget >= 5000000 && t.budget < 15000000
                  : t.budget >= 15000000)) &&
            (status === "all" || t.status === status) &&
            (tab === "Усі" ||
              (tab === "Нові"
                ? t.status === "Новий"
                : tab === "Проаналізовані"
                  ? t.status === "Проаналізовано"
                  : tab === "В роботі"
                    ? t.status === "В роботі"
                    : t.status === "Відхилено")) &&
            matchesDeadline(t.deadline, date) &&
            `${t.id} ${t.title} ${t.customer}`
              .toLowerCase()
              .includes(q.toLowerCase()),
        )
        .sort((a, b) => b.score - a.score),
    [state.tenders, q, priority, category, budget, date, status, tab],
  );
  const working = state.tenders.filter((t) => t.status === "В роботі");
  return (
    <>
      <PageHead
        title="Тендери"
        description="AI-скринінг, пріоритезація та робота команди в одному місці"
        actions={
          <div className="flex gap-2">
            <Inbox importOnly />
            <DemoButton variant="outline">
              <Download />
              Експорт
            </DemoButton>
          </div>
        }
      />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-3 h-auto flex-wrap justify-start bg-card">
          {["Усі", "Нові", "Проаналізовані", "В роботі", "Відхилені"].map(
            (x) => (
              <TabsTrigger key={x} value={x}>
                {x}
                <span className="ml-2 text-[10px] text-muted-foreground">
                  {x === "Усі"
                    ? state.tenders.length
                    : x === "Нові"
                      ? state.tenders.filter((t) => t.status === "Новий").length
                      : x === "Проаналізовані"
                        ? state.tenders.filter(
                            (t) => t.status === "Проаналізовано",
                          ).length
                        : x === "В роботі"
                          ? working.length
                          : state.tenders.filter(
                              (t) => t.status === "Відхилено",
                            ).length}
                </span>
              </TabsTrigger>
            ),
          )}
        </TabsList>
      </Tabs>
      {tab === "В роботі" && <WorkingView items={working} />}
      <Panel>
        <div className="mb-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-[1.4fr_repeat(5,minmax(130px,1fr))]">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="field pl-9"
              placeholder="Пошук…"
            />
          </div>
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
              {["Техніка", "Запчастини", "Обладнання", "Сервіс і роботи"].map(
                (x) => (
                  <SelectItem key={x} value={x}>
                    {x}
                  </SelectItem>
                ),
              )}
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
              <SelectItem value="all">Будь-яка дата</SelectItem>
              <SelectItem value="week">Цей тиждень</SelectItem>
              <SelectItem value="month">Цей місяць</SelectItem>
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Всі статуси</SelectItem>
              {["Новий", "Проаналізовано", "В роботі", "Відхилено"].map((x) => (
                <SelectItem key={x} value={x}>
                  {x}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {items.length ? <TenderGridTable items={items} /> : <Empty />}
      </Panel>
    </>
  );
}

function matchesDeadline(deadline: string, range: string) {
  if (range === "all") return true;
  // The exported alpha uses the showcase date, keeping its filters repeatable.
  const now = new Date(2026, 9, 6);
  const [day, month, year] = deadline.split(".").map(Number);
  if (!day || !month || !year) return false;
  const date = new Date(year, month - 1, day);
  if (range === "month")
    return (
      date >= now &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear()
    );
  const sunday = new Date(2026, 9, 11, 23, 59, 59);
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

const specs = [
  {
    code: "LF9009",
    brand: "Fleetguard",
    name: "Масляний фільтр",
    qty: 120,
    match: "Точний",
    status: "Підтверджено",
  },
  {
    code: "FS19532",
    brand: "Fleetguard",
    name: "Паливний сепаратор",
    qty: 80,
    match: "Точний",
    status: "Підтверджено",
  },
  {
    code: "AF26395",
    brand: "Fleetguard",
    name: "Повітряний фільтр",
    qty: 60,
    match: "Аналог",
    status: "На перевірці",
  },
  {
    code: "SO10068",
    brand: "HIFI",
    name: "Масляний фільтр",
    qty: 90,
    match: "Точний",
    status: "Підтверджено",
  },
  {
    code: "P550388",
    brand: "Donaldson",
    name: "Паливний фільтр",
    qty: 70,
    match: "Аналог",
    status: "На перевірці",
  },
  {
    code: "FF5488",
    brand: "Fleetguard",
    name: "Паливний фільтр",
    qty: 100,
    match: "Точний",
    status: "Підтверджено",
  },
  {
    code: "HF6555",
    brand: "Baldwin",
    name: "Гідравлічний фільтр",
    qty: 40,
    match: "Потребує перевірки",
    status: "Потребує уточнення",
  },
  {
    code: "LF3970",
    brand: "Fleetguard",
    name: "Масляний фільтр",
    qty: 65,
    match: "Точний",
    status: "Підтверджено",
  },
] as const;

const documents = [
  {
    name: "Технічне завдання.pdf",
    kind: "pdf",
    facts: [
      "8 позицій із точними каталожними номерами",
      "Еквіваленти дозволені з підтвердженням сумісності",
      "Поставка — до 30 календарних днів",
    ],
    sources: ["Джерело: стор. 3, п. 2.1", "Джерело: стор. 5, п. 4.2"],
    text: "Предмет закупівлі: фільтруючі елементи до тепловозів. Учасник постачає продукцію за каталожними номерами LF9009, FS19532, AF26395, SO10068, P550388, FF5488, HF6555 та LF3970. Допускається еквівалент за умови документального підтвердження сумісності. Строк поставки — 30 календарних днів.",
  },
  {
    name: "Специфікація.xlsx",
    kind: "sheet",
    facts: [
      "8 товарних позицій",
      "Загальна кількість — 625 шт",
      "4 бренди у вихідній специфікації",
    ],
    sources: ["Джерело: арк. 1, рядки 2–9"],
    text: "",
  },
  {
    name: "Проєкт договору.docx",
    kind: "doc",
    facts: [
      "Післяплата — 30 банківських днів",
      "Поставка — 30 календарних днів",
      "Гарантія товару — 12 місяців",
      "Штраф — 0,5% за день прострочення (DEMO)",
    ],
    sources: ["Джерело: стор. 6, п. 5.4", "Джерело: стор. 8, п. 7.2"],
    text: "Оплата здійснюється протягом 30 банківських днів після приймання товару. Постачальник зобов’язаний поставити товар протягом 30 календарних днів. Гарантійний строк — 12 місяців. За прострочення нараховується штраф 0,5% вартості непоставленого товару за кожний день (DEMO).",
  },
  {
    name: "Кваліфікаційні вимоги.pdf",
    kind: "pdf",
    facts: [
      "Не менше 2 аналогічних договорів",
      "Фінансова звітність за останній період",
      "Документи про повноваження підписанта",
    ],
    sources: ["Джерело: стор. 17, п. 4.3", "Джерело: стор. 18, п. 4.6"],
    text: "Учасник подає довідку та підтвердження виконання щонайменше двох аналогічних договорів, фінансову звітність за останній звітний період, а також наказ або довіреність, що підтверджує повноваження підписанта.",
  },
  {
    name: "Цінова форма.xlsx",
    kind: "price",
    facts: [
      "Ціни подаються без ПДВ і з ПДВ",
      "Сума розраховується за кожною позицією",
      "Формат і порядок колонок змінювати не можна",
    ],
    sources: ["Джерело: арк. 1, колонки A–F"],
    text: "",
  },
  {
    name: "Додаток 4.pdf",
    kind: "pdf",
    facts: [
      "Потрібен авторизаційний лист",
      "Для еквівалентів — підтвердження сумісності",
      "Лист має містити номер закупівлі",
    ],
    sources: ["Джерело: стор. 21, п. 2", "Джерело: стор. 21, п. 4"],
    text: "Для товару, що пропонується як еквівалент, учасник надає авторизаційний лист виробника або офіційного представника та таблицю підтвердження технічної сумісності із зазначенням номера закупівлі.",
  },
] as const;
export function TenderDetail({ id }: { id: string }) {
  const { state, updateTender, assignTender, setState } = useDemo();
  const t = state.tenders.find((x) => x.id === id);
  const [loading, setLoading] = useState(false);
  const [doc, setDoc] = useState<string | null>(null);
  const [tasks, setTasks] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [draftsReady, setDraftsReady] = useState(false);
  const [draftPreview, setDraftPreview] = useState<string | null>(null);
  if (!t) return <Empty text="Тендер не знайдено" />;
  const flow = detailFlow(t, specs, documents);
  const currentDoc = flow.documents.find((item) => item.name === doc);
  const rerun = () => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      toast.success("Аналіз оновлено");
    }, 900);
  };
  return (
    <>
      <PageHead
        title={t.title}
        description={`${t.id} · ${t.customer}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => {
                assignTender(
                  t.id,
                  t.manager === "—" ? managers[0].name : t.manager,
                );
                toast.success("Тендер додано в роботу");
              }}
            >
              В роботу
            </Button>
            <Button
              variant="outline"
              onClick={() => updateTender(t.id, "Відхилено")}
            >
              Відхилити
            </Button>
            <Button variant="outline" onClick={rerun}>
              <Sparkles />
              {loading ? "Аналізуємо…" : "Повторний AI-аналіз"}
            </Button>
            <DemoButton variant="ghost" result="Відкрито демо-оригінал">
              <MoreHorizontal />
            </DemoButton>
          </div>
        }
      />
      <div className="mb-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Metric label="Бюджет" value={money(t.budget)} />
        <Metric label="Дедлайн" value={t.deadline} />
        <Metric label="AI score" value={`${t.score}/100`} />
        <Metric label="Пріоритет" value={t.priority} />
        <Metric label="Статус" value={t.status} />
      </div>
      <Tabs defaultValue="overview">
        <TabsList className="mb-3 h-auto w-full justify-start overflow-x-auto bg-card p-1">
          <TabsTrigger value="overview">Огляд</TabsTrigger>
          <TabsTrigger value="spec">Специфікація</TabsTrigger>
          <TabsTrigger value="docs">Документи</TabsTrigger>
          <TabsTrigger value="prepare">Підготовка документів</TabsTrigger>
          <TabsTrigger value="req">Вимоги</TabsTrigger>
          <TabsTrigger value="ai">Аналіз AI</TabsTrigger>
          <TabsTrigger value="risks">Ризики</TabsTrigger>
          <TabsTrigger value="plan">План дій</TabsTrigger>
          <TabsTrigger value="history">Історія</TabsTrigger>
        </TabsList>
        <TabsContent value="overview">
          <div className="grid gap-3 lg:grid-cols-[1.3fr_.8fr]">
            <Panel title="Основна інформація">
              <Info
                rows={[
                  ["Предмет закупівлі", t.title],
                  ["Замовник", t.customer],
                  ["Категорія", `${t.topCategory} → ${t.category}`],
                  ["Очікувана вартість", money(t.budget)],
                  ["Строк поставки", flow.delivery],
                  ["Регіон", t.region],
                  ["Менеджер", t.manager],
                  ["Етап", t.stage],
                ]}
              />
            </Panel>
            <Panel title="Короткий AI-summary">
              <AI>AI висновок</AI>
              <p className="mt-3 text-sm leading-6">{flow.summary}</p>
            </Panel>
          </div>
        </TabsContent>
        <TabsContent value="spec">
          <Panel title="Специфікація">
            {flow.parts.length ? (
              <SpecPreview parts={flow.parts} />
            ) : (
              <Info rows={flow.technical} />
            )}
            {flow.parts.length > 0 && (
              <div className="mt-4 space-y-2">
                {flow.parts.map((part) => (
                  <div key={part.code} className="flex gap-3 text-sm">
                    <b>{part.code}</b>
                    <span>{part.match}</span>
                    <Status>{part.status}</Status>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </TabsContent>
        <TabsContent value="docs">
          <Panel title="Документи">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {flow.documents.map((item, i) => (
                <button
                  key={item.name}
                  onClick={() => setDoc(item.name)}
                  className="rounded-md border p-4 text-left transition hover:border-primary hover:bg-muted"
                >
                  <div className="flex items-center gap-3">
                    {i % 2 ? (
                      <FileSpreadsheet className="text-success" />
                    ) : (
                      <FileText className="text-danger" />
                    )}
                    <div>
                      <b className="text-sm">{item.name}</b>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {(i + 2) * 340} КБ · AI опрацьовано
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </Panel>
        </TabsContent>
        <TabsContent value="prepare">
          <Panel title="Підготовка документів">
            <div className="mb-4 flex flex-col gap-3 border-b pb-4 md:flex-row md:items-center md:justify-between">
              <div>
                <AI>Контроль менеджера</AI>
                <p className="mt-2 text-sm font-medium">
                  AI формує чернетку — фінальне підтвердження менеджером
                </p>
              </div>
              <Button
                disabled={drafting}
                onClick={() => {
                  setDrafting(true);
                  setTimeout(() => {
                    setDrafting(false);
                    setDraftsReady(true);
                    toast.success("Чернетки сформовано");
                  }, 900);
                }}
              >
                <Sparkles className={drafting ? "animate-spin" : ""} />
                {drafting ? "Формуємо…" : "Сформувати чернетки"}
              </Button>
            </div>
            <div className="space-y-2">
              {[
                [
                  "Гарантійний лист",
                  draftsReady ? "Чернетка готова" : "Готовий шаблон",
                ],
                [
                  "Довідка про аналогічні договори",
                  draftsReady
                    ? "2 договори додано"
                    : "Потрібно підтягнути 2 договори",
                ],
                [
                  "Технічна таблиця відповідності",
                  draftsReady
                    ? "Чернетка готова — підтвердити параметри"
                    : "Очікує підтвердження параметрів",
                ],
                [
                  "Цінова пропозиція",
                  draftsReady
                    ? "Чернетка готова — перевірте ціни"
                    : "Очікує цін",
                ],
                ["Лист-згода з умовами договору", "Чернетка готова"],
              ].map(([name, status]) => (
                <div
                  key={name}
                  className="flex flex-col gap-3 rounded-md border p-4 sm:flex-row sm:items-center"
                >
                  <FileText className="text-primary" />
                  <div className="flex-1">
                    <b className="text-sm">{name}</b>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {status}
                    </p>
                  </div>
                  <Status>{status}</Status>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setDraftPreview(name ?? null)}
                  >
                    Переглянути
                  </Button>
                </div>
              ))}
            </div>
          </Panel>
        </TabsContent>
        <TabsContent value="req">
          <Panel title="Кваліфікаційні вимоги">
            <div className="grid gap-2 md:grid-cols-2">
              {flow.requirements.map((x, i) => (
                <div className="rounded-md border p-4" key={x}>
                  <div className="flex gap-2">
                    <CheckCircle2
                      className={i === 2 ? "text-warning" : "text-success"}
                    />
                    <b className="text-sm">{x}</b>
                  </div>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="ghost"
                        className="mt-2 h-auto p-0 text-xs"
                      >
                        Демо-витяг із вимог
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="text-xs">
                      Витяг із кваліфікаційних вимог. AI позначив цей пункт як
                      важливий.
                    </PopoverContent>
                  </Popover>
                </div>
              ))}
            </div>
          </Panel>
        </TabsContent>
        <TabsContent value="ai">
          <div className="grid gap-3 lg:grid-cols-2">
            <Panel title={`Відповідність ${t.score}/100`}>
              <Progress value={t.score} />
              <AnalysisBlock title="Чому цікаво" text={flow.summary} />
              <AnalysisBlock
                title="Що потрібно перевірити"
                text={flow.checks}
              />
              <AnalysisBlock
                title="Основна складність"
                text={flow.risks.join("; ")}
              />
              <AnalysisBlock
                title="Рекомендований сценарій входу"
                text={t.recommendation}
              />
              <Button onClick={rerun} disabled={loading}>
                <RefreshCw className={loading ? "animate-spin" : ""} />
                Оновити аналіз
              </Button>
            </Panel>
            <Panel title="Рішення команди">
              <p className="text-sm">{t.recommendation}</p>
              <label className="mt-4 block text-sm">
                Менеджер
                <Select
                  value={t.manager}
                  onValueChange={(name) => assignTender(t.id, name)}
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="—">Не призначено</SelectItem>
                    {managers.map((m) => (
                      <SelectItem key={m.name} value={m.name}>
                        {m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
              <label className="mt-4 block text-sm">
                Етап
                <Select
                  value={t.stage}
                  onValueChange={(stage) =>
                    setState((s) => ({
                      ...s,
                      tenders: s.tenders.map((item) =>
                        item.id === t.id ? { ...item, stage } : item,
                      ),
                    }))
                  }
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[
                      "Аналіз",
                      "Прорахунок",
                      "Уточнення",
                      "Документи",
                      "Подано",
                      "Аукціон",
                      "Завершено",
                    ].map((stage) => (
                      <SelectItem key={stage} value={stage}>
                        {stage}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
            </Panel>
          </div>
        </TabsContent>
        <TabsContent value="risks">
          <Panel title="Ризики та обмеження">
            <div className="space-y-2">
              {flow.risks.map((risk, i) => (
                <div
                  key={risk}
                  className="flex items-start gap-3 rounded-md border p-3"
                >
                  <AlertTriangle
                    className={i === 0 ? "text-danger" : "text-warning"}
                  />
                  <div>
                    <Status>Перевірити</Status>
                    <p className="mt-2 text-sm">{risk}</p>
                    <button
                      className="mt-1 text-xs text-primary"
                      onClick={() =>
                        toast.info(`${risk}: звірити з оригіналом документації`)
                      }
                    >
                      Переглянути джерело
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </TabsContent>
        <TabsContent value="plan">
          <Panel title="AI-план дій">
            <div className="space-y-2">
              {flow.plan.map((x, i) => (
                <div
                  key={x}
                  className="flex items-center gap-3 rounded-md border p-3"
                >
                  <span className="grid size-7 place-items-center rounded-full bg-muted text-xs">
                    {i + 1}
                  </span>
                  <span className="flex-1 text-sm">{x}</span>
                  {tasks && <Status>Створено</Status>}
                </div>
              ))}
            </div>
            <Button
              className="mt-4"
              onClick={() => {
                setTasks(true);
                toast.success(`${flow.plan.length} задач створено`);
              }}
            >
              Створити задачі
            </Button>
          </Panel>
        </TabsContent>
        <TabsContent value="history">
          <Panel title="Історія">
            <div className="space-y-5">
              {[
                ["04.09 · 10:42", "Менеджер змінив статус на «В роботі»"],
                [
                  "04.09 · 09:18",
                  `Документ «${flow.documents[1]?.name}» додано`,
                ],
                ["03.09 · 18:05", `AI-скринінг завершено · score ${t.score}`],
                ["03.09 · 17:52", "Тендер імпортовано з Prozorro"],
              ].map((x) => (
                <div key={x[0]} className="flex gap-3">
                  <Clock className="size-4 text-primary" />
                  <div>
                    <b className="text-xs">{x[0]}</b>
                    <p className="text-sm text-muted-foreground">{x[1]}</p>
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </TabsContent>
      </Tabs>
      <Dialog open={!!doc} onOpenChange={() => setDoc(null)}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>{doc}</DialogTitle>
            <DialogDescription>
              <span className="mr-2 rounded bg-warning/15 px-2 py-1 text-[11px] font-semibold text-warning">
                DEMO-ДАНІ
              </span>
              <AI>AI опрацював документ</AI>
            </DialogDescription>
          </DialogHeader>
          {currentDoc && (
            <div className="grid max-h-[560px] gap-3 overflow-auto lg:grid-cols-[1.4fr_.7fr]">
              <div className="rounded-md bg-muted p-5">
                <div className="min-h-[390px] bg-card p-7 shadow">
                  <div className="mb-6 flex items-center justify-between border-b pb-3">
                    <h3 className="font-semibold">{currentDoc.name}</h3>
                    <span className="text-[10px] font-bold text-muted-foreground">
                      DEMO PREVIEW
                    </span>
                  </div>
                  {currentDoc.kind === "technical" ? (
                    <Info rows={flow.technical} />
                  ) : currentDoc.kind === "sheet" ? (
                    <SpecPreview parts={flow.parts} />
                  ) : currentDoc.kind === "price" ? (
                    <PricePreview parts={flow.parts} />
                  ) : (
                    <p className="whitespace-pre-line text-sm leading-7">
                      {currentDoc.text}
                    </p>
                  )}
                </div>
              </div>
              <aside className="rounded-md border border-ai/25 bg-ai/10 p-4">
                <AI>AI витягнув</AI>
                <div className="mt-4 space-y-3">
                  {currentDoc.facts.map((fact) => (
                    <div key={fact} className="flex gap-2 text-sm">
                      <CheckCircle2 className="size-4 shrink-0 text-success" />
                      <span>{fact}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-5 border-t pt-4">
                  {currentDoc.sources.map((source) => (
                    <button
                      key={source}
                      className="mb-2 block text-left text-xs font-medium text-primary"
                      onClick={() => toast.info(source)}
                    >
                      {source}
                    </button>
                  ))}
                </div>
              </aside>
            </div>
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={!!draftPreview} onOpenChange={() => setDraftPreview(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{draftPreview}.docx</DialogTitle>
            <DialogDescription>
              <span className="mr-2 rounded bg-warning/15 px-2 py-1 text-[11px] font-semibold text-warning">
                DEMO-ЧЕРНЕТКА
              </span>
              <AI>Створено на базі шаблону</AI>
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-md bg-muted p-6">
            <div className="min-h-72 bg-card p-8 shadow">
              <h3 className="text-center font-semibold">{draftPreview}</h3>
              <p className="mt-8 text-sm leading-7">
                {t.customer}
                <br />
                Закупівля {t.id}
              </p>
              <p className="mt-5 text-sm leading-7">
                Цим листом підтверджуємо відповідність запропонованої продукції
                вимогам тендерної документації та готовність виконати поставку у
                встановлений строк.
              </p>
              <p className="mt-8 text-sm">
                Керівник ____________ / погодити менеджеру
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
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
  parts = specs,
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
  parts = specs,
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
                    .filter((t) => t.status === "В роботі")
                    .filter((t, i) => getCol(t, i) === c).length
                }
              </span>
            </div>
            {state.tenders
              .filter((t) => t.status === "В роботі")
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
  const [busy, setBusy] = useState<string | null>(null);
  const exportCsv = (name: string) => {
    setBusy(name);
    setTimeout(() => {
      const blob = new Blob(
        [
          "ID,Назва,Бюджет\n" +
            seed.map((t) => `${t.id},"${t.title}",${t.budget}`).join("\n"),
        ],
        { type: "text/csv;charset=utf-8" },
      );
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "tenderpro-demo.csv";
      a.click();
      setBusy(null);
      toast.success("Файл сформовано");
    }, 700);
  };
  return (
    <>
      <PageHead
        title="Експорт"
        description="Сформуйте вибірку тендерів для подальшої роботи"
      />
      <Panel title="Як TenderPro перетворює Excel" className="mb-3">
        <div className="grid items-stretch gap-3 xl:grid-cols-[1fr_90px_1fr]">
          <div className="min-w-0 rounded-md border">
            <div className="border-b bg-muted px-4 py-3">
              <b className="text-sm">Вхідний Excel</b>
              <p className="text-xs text-muted-foreground">
                Фактичні дані підписки
              </p>
            </div>
            <MiniInputTable />
          </div>
          <div className="flex flex-col items-center justify-center gap-2 py-4 text-ai">
            <Sparkles />
            <b className="text-center text-xs">AI ANALYSIS</b>
            <ArrowRight className="hidden xl:block" />
          </div>
          <div className="min-w-0 rounded-md border border-ai/25">
            <div className="border-b bg-ai/10 px-4 py-3">
              <b className="text-sm">Результат TenderPro</b>
              <p className="text-xs text-muted-foreground">
                Класифіковано та пріоритезовано
              </p>
            </div>
            <MiniResultTable />
          </div>
        </div>
        <div className="mt-4 grid gap-3 border-t pt-4 text-xs md:grid-cols-4">
          {[
            ["1", "Фактичні поля копіюються без AI"],
            ["2", "AI додає класифікацію та аналіз"],
            ["3", "Правила компанії коригують score"],
            ["4", "Менеджер підтверджує результат"],
          ].map(([n, text]) => (
            <div key={n} className="flex gap-2">
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
                {n}
              </span>
              <span className="text-muted-foreground">{text}</span>
            </div>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-md bg-muted p-3">
          <div>
            <b className="text-sm">Демо-файл із 5 обробленими рядками</b>
            <p className="text-xs text-muted-foreground">
              CSV відкривається у Microsoft Excel
            </p>
          </div>
          <Button
            onClick={() => exportCsv("demo-flow")}
            disabled={busy === "demo-flow"}
          >
            <Download />
            {busy === "demo-flow" ? "Готуємо файл…" : "Завантажити демо Excel"}
          </Button>
        </div>
      </Panel>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {[
          "Усі тендери",
          "Пріоритет A",
          "В роботі",
          "За період",
          "Запчастини",
          "Кастомний експорт",
        ].map((x, i) => (
          <Panel key={x}>
            <Download className="text-primary" />
            <h3 className="mt-4 font-semibold">{x}</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {[12, 5, 7, 9, 6, 0][i] || "Оберіть поля"} записів · CSV / Excel
            </p>
            {busy === x ? (
              <Progress value={72} className="mt-5" />
            ) : (
              <Button
                className="mt-5"
                variant="outline"
                onClick={() => exportCsv(x)}
              >
                Сформувати Excel
              </Button>
            )}
          </Panel>
        ))}
      </div>
    </>
  );
}

function MiniInputTable() {
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Предмет</th>
            <th>CPV</th>
            <th>Бюджет</th>
            <th>Замовник</th>
            <th>Дедлайн</th>
          </tr>
        </thead>
        <tbody>
          {seed.slice(0, 5).map((t) => (
            <tr key={t.id}>
              <td>{t.id.slice(-8)}</td>
              <td className="min-w-40 font-medium">{t.title}</td>
              <td>34630000-2</td>
              <td>{money(t.budget)}</td>
              <td>{t.customer}</td>
              <td>{t.deadline}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function MiniResultTable() {
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Категорія</th>
            <th>Підкатегорія</th>
            <th>Score</th>
            <th>Пріоритет</th>
            <th>Ризики</th>
            <th>Рекомендація</th>
            <th>Статус</th>
          </tr>
        </thead>
        <tbody>
          {seed.slice(0, 5).map((t, i) => (
            <tr key={t.id}>
              <td>{t.id.slice(-8)}</td>
              <td>{i === 3 ? "Роботи" : "Запчастини"}</td>
              <td>{t.category}</td>
              <td>
                <Score value={t.score} />
              </td>
              <td>
                <Status>{t.priority}</Status>
              </td>
              <td>{i === 3 ? "Високі" : i === 2 ? "Середні" : "Низькі"}</td>
              <td className="min-w-36">
                {t.score >= 80
                  ? "Брати в роботу"
                  : t.score >= 60
                    ? "Перевірити"
                    : "Відхилити"}
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
