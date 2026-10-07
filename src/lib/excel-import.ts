import type { Tender } from "./demo-data";
import { dateValid } from "./table-range.ts";
import { deadlineDate, exactTimestamp } from "./tender-period.ts";
import { kyivToday } from "./tender-workflow.ts";
import { commentPalette } from "./worksheet-model.ts";

export const importHeaders = [
  "Назва закупівлі",
  "Предмет закупівлі",
  "ID",
  "Дата початку подання",
  "Час початку",
  "Дата завершення",
  "Час завершення",
  "Загальна сума",
  "Замовник",
  "Категорія",
  "Коментар",
  "Кількість",
  "Од. виміру",
  "Ціна за одиницю",
  "Дата публікації",
  "Адреса",
  "Період поставки",
  "Технічні вимоги",
  "Кваліфікаційні вимоги",
  "Особливі вимоги",
  "Ключові характеристики",
  "Колір коментаря",
] as const;
type Header = (typeof importHeaders)[number];
export type ImportResult = {
  tenders: Tender[];
  issues: { row: number; message: string }[];
  duplicates: number;
  total: number;
};
const aliases: Record<string, Header> = {
  назва: "Назва закупівлі",
  "назва тендера": "Назва закупівлі",
  "об'єкт": "Предмет закупівлі",
  предмет: "Предмет закупівлі",
  "номер тендера": "ID",
  ідентифікатор: "ID",
  дедлайн: "Дата завершення",
  "дата завершення подання": "Дата завершення",
  сума: "Загальна сума",
  бюджет: "Загальна сума",
  "одиниця виміру": "Од. виміру",
  ціна: "Ціна за одиницю",
};
const normalizeHeader = (value: string) =>
  value
    .trim()
    .toLocaleLowerCase("uk-UA")
    .replace(/[’ʼ]/g, "'")
    .replace(/\s+/g, " ");
const text = (value: unknown): string => {
  if (value === null || value === undefined) return "";
  if (typeof value === "object" && !(value instanceof Date)) {
    const v = value as {
      text?: string;
      richText?: { text: string }[];
      result?: unknown;
    };
    return (
      v.text ??
      v.richText?.map((x) => x.text).join("") ??
      (v.result !== undefined ? text(v.result) : "")
    );
  }
  return String(value).trim();
};
function dateText(value: unknown): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const v = text(value);
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : deadlineDate(v);
  return iso && dateValid(iso) ? iso : "";
}
function timeText(value: unknown): string {
  if (value instanceof Date)
    return value.toISOString().slice(11, value.getUTCSeconds() ? 19 : 16);
  if (typeof value === "number" && value >= 0 && value < 1) {
    const seconds = Math.round(value * 86400);
    const minutes = Math.floor(seconds / 60);
    if (minutes >= 1440) return "";
    return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}${seconds % 60 ? ":" + String(seconds % 60).padStart(2, "0") : ""}`;
  }
  const v = text(value);
  const match = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(v);
  return match &&
    Number(match[1]) < 24 &&
    Number(match[2]) < 60 &&
    (!match[3] || Number(match[3]) < 60)
    ? `${match[1]!.padStart(2, "0")}:${match[2]}${match[3] ? ":" + match[3] : ""}`
    : "";
}
const wallClock = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Kyiv",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});
export function kyivDateTime(date: string, time: string): string | null {
  if (!dateValid(date) || !timeText(time)) return null;
  const [year, month, day] = date.split("-").map(Number),
    [hour, minute, second = 0] = time.split(":").map(Number);
  const desired = Date.UTC(year!, month! - 1, day!, hour!, minute!, second);
  let stamp = desired;
  for (let i = 0; i < 4; i++) {
    const parts = Object.fromEntries(
      wallClock.formatToParts(stamp).map((p) => [p.type, Number(p.value)]),
    );
    const actual = Date.UTC(
      parts["year"]!,
      parts["month"]! - 1,
      parts["day"]!,
      parts["hour"]!,
      parts["minute"]!,
      parts["second"]!,
    );
    const delta = desired - actual;
    if (delta === 0) return new Date(stamp).toISOString();
    stamp += delta;
  }
  return null; // A nonexistent clock time during the DST transition is rejected.
}
function readPeriod(dateValue: unknown, timeValue: unknown): string | null {
  const raw = text(dateValue);
  if (!(dateValue instanceof Date) && exactTimestamp(raw) !== null) return raw;
  const day = dateText(dateValue);
  if (!day) return null;
  const rawTime = text(timeValue);
  if (
    !rawTime &&
    dateValue instanceof Date &&
    (dateValue.getUTCHours() || dateValue.getUTCMinutes())
  )
    return kyivDateTime(day, timeText(dateValue));
  if (!rawTime) return day;
  const clock = timeText(timeValue);
  return clock ? kyivDateTime(day, clock) : null;
}
function numberValue(value: unknown): number | null {
  if (typeof value === "number")
    return Number.isFinite(value) && value >= 0 ? value : null;
  const raw = text(value)
    .replace(/[\s\u00a0₴]/g, "")
    .replace(/грн\.?$/i, "")
    .replace(",", ".");
  if (!/^\d+(?:\.\d+)?$/.test(raw)) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}
const list = (value: unknown) =>
  text(value)
    .split(/\r?\n|;/)
    .map((v) => v.trim())
    .filter(Boolean);

export async function createImportTemplateWorkbook() {
  const { default: ExcelJS } = await import("exceljs");
  const book = new ExcelJS.Workbook();
  book.creator = "TenderPro";
  const sheet = book.addWorksheet("Імпорт", {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  sheet.columns = importHeaders.map((header) => ({
    header,
    width: /Назва|Предмет|Замовник|вимоги/.test(header) ? 35 : 23,
  }));
  sheet.getRow(1).height = 32;
  sheet.getRow(1).eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF263342" },
    };
    cell.alignment = { wrapText: true, vertical: "middle" };
  });
  for (let row = 2; row <= 41; row++) {
    for (let column = 1; column <= importHeaders.length; column++) {
      const cell = sheet.getCell(row, column);
      cell.numFmt = "@";
      cell.alignment = { wrapText: true, vertical: "top" };
      if ([8, 12, 14].includes(column)) cell.numFmt = "0.##";
    }
    sheet.getCell(row, 10).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: ['"Техніка,Запчастини,Обладнання,Будівництво,Послуги,Інше"'],
    };
    sheet.getCell(row, 22).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: ['"none,yellow,green,red,blue,purple,gray"'],
    };
  }
  const notes = book.addWorksheet("Інструкція");
  notes.getColumn(1).width = 105;
  [
    "Шаблон імпорту TenderPro",
    "Заповніть аркуш Імпорт: один рядок = один тендер. Порожні рядки пропускаються.",
    "Обов'язково: Назва закупівлі, ID, Дата завершення, Загальна сума, Замовник.",
    "ID: UA-YYYY-MM-DD-000001-a. Дати: ДД.ММ.РРРР або YYYY-MM-DD. Час: HH:mm за Europe/Kyiv.",
    "Час можна залишити порожнім, якщо джерело його не надало. Не зазначайте вигадані години.",
    "Предмети, характеристики та вимоги: кілька значень через новий рядок або крапку з комою.",
    "Сума, кількість і ціна: невід'ємні числа. Невідомі необов'язкові поля залишайте порожніми.",
    "Дата публікації необов'язкова: за відсутності береться з ID. Період даних фільтрує саме дату публікації.",
    "Дублікати ID не перезаписують існуючі тендери. Перед імпортом буде показано результат перевірки.",
    "Шаблон імпорту та експорт поточного вигляду — різні файли.",
  ].forEach((note) => notes.addRow([note]));
  notes.getRow(1).font = { bold: true, size: 16 };
  notes.eachRow((row) => (row.alignment = { wrapText: true }));
  return book;
}
export async function downloadImportTemplate() {
  const book = await createImportTemplateWorkbook();
  const bytes = new Uint8Array(await book.xlsx.writeBuffer());
  const url = URL.createObjectURL(
    new Blob([bytes], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = "TenderPro_import_template.xlsx";
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
export async function parseImportWorkbook(
  bytes: ArrayBuffer | Uint8Array,
  existing: ReadonlySet<string> = new Set(),
): Promise<ImportResult> {
  const { default: ExcelJS } = await import("exceljs");
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(
    bytes as unknown as Parameters<typeof book.xlsx.load>[0],
  );
  const sheet = book.getWorksheet("Імпорт") ?? book.worksheets[0];
  if (!sheet) throw new Error("У файлі немає аркуша з даними.");
  const columns = new Map<Header, number>();
  sheet.getRow(1).eachCell((cell, index) => {
    const key = normalizeHeader(text(cell.value));
    const canonical =
      importHeaders.find((h) => normalizeHeader(h) === key) ?? aliases[key];
    if (canonical) {
      if (columns.has(canonical))
        throw new Error(`Повторний заголовок: ${canonical}`);
      columns.set(canonical, index);
    }
  });
  for (const name of [
    "Назва закупівлі",
    "ID",
    "Дата завершення",
    "Загальна сума",
    "Замовник",
  ] as Header[])
    if (!columns.has(name))
      throw new Error(`Відсутня колонка «${name}». Завантажте шаблон імпорту.`);
  const result: ImportResult = {
    tenders: [],
    issues: [],
    duplicates: 0,
    total: 0,
  };
  const seen = new Set(existing);
  for (let index = 2; index <= sheet.rowCount; index++) {
    const row = sheet.getRow(index);
    const get = (key: Header) =>
      columns.has(key) ? row.getCell(columns.get(key)!).value : null;
    if (![...columns.values()].some((c) => text(row.getCell(c).value)))
      continue;
    result.total++;
    try {
      const id = text(get("ID"));
      if (
        !/^UA-\d{4}-\d{2}-\d{2}-\d{6}-[a-z]$/i.test(id) ||
        !dateValid(id.slice(3, 13))
      )
        throw new Error("Некоректний ID тендера.");
      if (seen.has(id)) {
        result.duplicates++;
        continue;
      }
      const title = text(get("Назва закупівлі")),
        customer = text(get("Замовник"));
      if (!title || !customer)
        throw new Error("Назва закупівлі та Замовник обов'язкові.");
      const end = readPeriod(get("Дата завершення"), get("Час завершення"));
      if (!end) throw new Error("Некоректна дата/час завершення (Київ).");
      const startValue = get("Дата початку подання");
      if (!text(startValue) && text(get("Час початку")))
        throw new Error(
          "Для часу початку потрібно вказати дату початку подання.",
        );
      const start = text(startValue)
        ? readPeriod(startValue, get("Час початку"))
        : id.slice(3, 13);
      if (
        !start ||
        (exactTimestamp(start) !== null && exactTimestamp(end) !== null
          ? Date.parse(start) > Date.parse(end)
          : start.slice(0, 10) > end.slice(0, 10))
      )
        throw new Error(
          "Некоректний період подання: початок пізніше завершення.",
        );
      const budget = numberValue(get("Загальна сума"));
      if (budget === null)
        throw new Error("Загальна сума має бути невід'ємним числом.");
      const optionalNumber = (key: Header) => {
        if (!text(get(key))) return undefined;
        const n = numberValue(get(key));
        if (n === null) throw new Error(`Некоректне число: ${key}`);
        return n;
      };
      const quantity = optionalNumber("Кількість"),
        unitPrice = optionalNumber("Ціна за одиницю"),
        unit = text(get("Од. виміру"));
      const category = text(get("Категорія")) || "Інше";
      const topCategory: Tender["topCategory"] = [
        "Техніка",
        "Запчастини",
        "Обладнання",
      ].includes(category)
        ? (category as Tender["topCategory"])
        : ["Будівництво", "Послуги"].includes(category)
          ? "Сервіс і роботи"
          : "Інше";
      const colorRaw = text(get("Колір коментаря")) || "none";
      const color = commentPalette.find(
        (c) =>
          c.value === colorRaw ||
          c.label.toLocaleLowerCase("uk-UA") ===
            colorRaw.toLocaleLowerCase("uk-UA"),
      );
      if (!color) throw new Error("Невідомий колір коментаря.");
      const publicationRaw = get("Дата публікації");
      const publication = text(publicationRaw)
        ? dateText(publicationRaw)
        : id.slice(3, 13);
      if (!publication) throw new Error("Некоректна дата публікації.");
      const comment = text(get("Коментар"));
      const subjects = list(get("Предмет закупівлі"));
      result.tenders.push({
        id,
        title,
        customer,
        category,
        topCategory,
        budget,
        deadline: kyivToday(
          new Date(exactTimestamp(end) ?? Date.parse(end + "T12:00:00Z")),
        )
          .split("-")
          .reverse()
          .join("."),
        region: "-",
        priority: "C",
        score: 0,
        analysisPending: true,
        importSource: "excel",
        status: "NEW",
        manager: "—",
        stage: "Аналіз",
        recommendation: "-",
        publishedAt: publication,
        publicationDateSource: text(publicationRaw) ? "source" : "tender-id",
        submissionPeriod: { start, end },
        comment,
        commentText: comment,
        commentColor: color.value,
        objects: subjects.map((name) => ({
          name,
          characteristics:
            subjects.length === 1 ? list(get("Ключові характеристики")) : [],
          ...(subjects.length === 1 && quantity !== undefined
            ? { quantity }
            : {}),
          ...(subjects.length === 1 && unit ? { unit } : {}),
        })),
        ...(quantity !== undefined ? { quantity } : {}),
        ...(unit ? { unit } : {}),
        ...(unitPrice !== undefined ? { unitPrice } : {}),
        ...(text(get("Адреса")) ? { address: text(get("Адреса")) } : {}),
        ...(text(get("Період поставки"))
          ? { deliveryPeriod: { text: text(get("Період поставки")) } }
          : {}),
        technicalRequirements: list(get("Технічні вимоги")),
        qualificationRequirements: list(get("Кваліфікаційні вимоги")),
        specialRequirements: list(get("Особливі вимоги")),
      });
      seen.add(id);
    } catch (error) {
      result.issues.push({
        row: index,
        message: error instanceof Error ? error.message : "Некоректний рядок.",
      });
    }
  }
  return result;
}
