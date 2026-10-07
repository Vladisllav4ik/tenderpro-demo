export type Tender = {
  id: string;
  title: string;
  customer: string;
  category: string;
  topCategory:
    "Техніка" | "Запчастини" | "Обладнання" | "Сервіс і роботи" | "Інше";
  budget: number;
  deadline: string;
  region: string;
  priority: "A" | "B" | "C";
  score: number;
  analysisPending?: boolean;
  importSource?: "excel";
  status: string;
  manager: string;
  stage: string;
  recommendation: string;
  publishedAt?: string;
  publicationDateSource?: "source" | "tender-id" | "loaded";
  comment?: string;
  commentText?: string;
  commentColor?:
    "none" | "yellow" | "green" | "red" | "blue" | "purple" | "gray";
  objects?: {
    name: string;
    quantity?: number;
    unit?: string;
    catalogue?: string;
    brand?: string;
    characteristics?: string[];
  }[];
  quantity?: number;
  unit?: string;
  unitPrice?: number;
  submissionPeriod?: { start?: string; end?: string };
  auctionPeriod?: { start?: string; end?: string };
  deliveryPeriod?: { start?: string; end?: string; text?: string };
  address?: string;
  specialRequirements?: string[];
  technicalRequirements?: string[];
  qualificationRequirements?: string[];
  lifecycle?: {
    state?:
      | "active"
      | "cancelled"
      | "awarded"
      | "disqualified"
      | "rejected"
      | "closed";
    participation?: "submitted" | "not-submitted";
    decision?: "pending" | "won" | "lost";
    submittedAt?: string;
    updatedAt?: string;
    reason?: string;
  };
  commentUpdatedAt?: string;
  firstViewedAt?: string;
  manualStatusOverride?: boolean;
  previousStatus?: string;
  completedAt?: string;
  completionType?: "success" | "failed";
  statusRecalcAt?: string;
  statusOrigin?: "view" | "comment" | "lifecycle" | "deadline";
  statusChangedAt?: string;
  history?: {
    at: string;
    kind: string;
    text: string;
    from?: string;
    to?: string;
  }[];
  documentStates?: Record<string, { downloaded?: boolean; parsed?: boolean }>;
};

export const managers = [
  { name: "Влад Михайлов", initials: "ВМ" },
  { name: "Олена Коваль", initials: "ОК" },
  { name: "Андрій Бондар", initials: "АБ" },
] as const;

export const tenders: Tender[] = [
  {
    id: "UA-2026-08-25-006722-a",
    title: "Фільтруючі елементи до тепловозів",
    customer: "КП «Київський метрополітен»",
    category: "Залізничні запчастини",
    topCategory: "Запчастини",
    budget: 4426051,
    deadline: "08.09.2026",
    region: "Київ",
    priority: "A",
    score: 82,
    status: "Новий",
    manager: "—",
    stage: "Аналіз",
    recommendation: "Перевірити аналоги й авторизаційний лист",
  },
  {
    id: "UA-2026-10-02-004811-a",
    title: "Самоскиди DONGFENG, 4 од.",
    customer: "АТ «Укргазвидобування»",
    category: "Вантажна техніка",
    topCategory: "Техніка",
    budget: 32400000,
    deadline: "22.10.2026",
    region: "Полтава",
    priority: "A",
    score: 94,
    status: "Проаналізовано",
    manager: "—",
    stage: "Аналіз",
    recommendation: "Брати в роботу — висока відповідність",
  },
  {
    id: "UA-2026-10-01-007250-a",
    title: "Сідельні тягачі DONGFENG, 3 од.",
    customer: "АТ «Укрнафта»",
    category: "Вантажна техніка",
    topCategory: "Техніка",
    budget: 21600000,
    deadline: "24.10.2026",
    region: "Київ",
    priority: "A",
    score: 91,
    status: "В роботі",
    manager: "Влад Михайлов",
    stage: "Прорахунок",
    recommendation: "Подати пропозицію після підтвердження строку",
  },
  {
    id: "UA-2026-09-29-003902-a",
    title: "Автокран XCMG QY25K5 або аналог, 2 од.",
    customer: "ДП «Антонов»",
    category: "Підіймальна техніка",
    topCategory: "Техніка",
    budget: 27600000,
    deadline: "20.10.2026",
    region: "Київ",
    priority: "A",
    score: 93,
    status: "В роботі",
    manager: "Олена Коваль",
    stage: "Документи",
    recommendation: "Брати в роботу — технічні вимоги відповідають",
  },
  {
    id: "UA-2026-10-03-001644-a",
    title: "Фронтальні навантажувачі XCMG, 2 од.",
    customer: "КП «Київавтодор»",
    category: "Будівельна техніка",
    topCategory: "Техніка",
    budget: 14800000,
    deadline: "27.10.2026",
    region: "Київ",
    priority: "A",
    score: 88,
    status: "Проаналізовано",
    manager: "—",
    stage: "Аналіз",
    recommendation: "Уточнити об’єм ковша та сервісну мережу",
  },
  {
    id: "UA-2026-10-04-006119-a",
    title: "Екскаватори-навантажувачі XCMG, 2 од.",
    customer: "КП «Дніпроводоканал»",
    category: "Будівельна техніка",
    topCategory: "Техніка",
    budget: 12600000,
    deadline: "29.10.2026",
    region: "Дніпро",
    priority: "A",
    score: 90,
    status: "В роботі",
    manager: "Андрій Бондар",
    stage: "Аналіз",
    recommendation: "Брати в роботу — маржа прогнозовано 15%",
  },
  {
    id: "UA-2026-09-01-001485-a",
    title: "Запчастини XCMG",
    customer: "АТ «Укргазвидобування»",
    category: "XCMG",
    topCategory: "Запчастини",
    budget: 5200000,
    deadline: "12.10.2026",
    region: "Полтава",
    priority: "A",
    score: 92,
    status: "В роботі",
    manager: "Влад Михайлов",
    stage: "Подано",
    recommendation: "Подати пропозицію",
  },
  {
    id: "UA-2026-09-02-005620-a",
    title: "Запасні частини до екскаваторів Komatsu",
    customer: "АТ «Укрзалізниця»",
    category: "Запчастини",
    topCategory: "Запчастини",
    budget: 3850000,
    deadline: "14.10.2026",
    region: "Дніпро",
    priority: "A",
    score: 89,
    status: "Проаналізовано",
    manager: "—",
    stage: "Аналіз",
    recommendation: "Перевірити сумісність двох позицій",
  },
  {
    id: "UA-2026-09-03-002870-a",
    title: "Гідравлічні насоси високого тиску",
    customer: "ДП «Антонов»",
    category: "Гідравліка",
    topCategory: "Запчастини",
    budget: 2730000,
    deadline: "10.10.2026",
    region: "Київ",
    priority: "A",
    score: 86,
    status: "В роботі",
    manager: "Олена Коваль",
    stage: "Прорахунок",
    recommendation: "Отримати закупівельні ціни",
  },
  {
    id: "UA-2026-08-29-003144-a",
    title: "Перетворювачі частоти",
    customer: "ПрАТ «АК Київводоканал»",
    category: "Електрообладнання",
    topCategory: "Обладнання",
    budget: 12100000,
    deadline: "15.10.2026",
    region: "Київ",
    priority: "B",
    score: 68,
    status: "Проаналізовано",
    manager: "—",
    stage: "Аналіз",
    recommendation: "Ручна технічна перевірка",
  },
  {
    id: "UA-2026-08-21-009540-a",
    title: "Будівництво загальноосвітньої школи",
    customer: "Департамент освіти Львівської МР",
    category: "Будівельні роботи",
    topCategory: "Сервіс і роботи",
    budget: 38000000,
    deadline: "25.10.2026",
    region: "Львів",
    priority: "C",
    score: 24,
    status: "Відхилено",
    manager: "—",
    stage: "Аналіз",
    recommendation: "Не відповідає профілю компанії",
  },
  {
    id: "UA-2026-08-27-004102-a",
    title: "Компресорне обладнання для цеху",
    customer: "ПАТ «Центренерго»",
    category: "Компресорне",
    topCategory: "Обладнання",
    budget: 6900000,
    deadline: "18.10.2026",
    region: "Київська обл.",
    priority: "B",
    score: 73,
    status: "Проаналізовано",
    manager: "—",
    stage: "Аналіз",
    recommendation: "Перевірити сервісні вимоги",
  },
  {
    id: "UA-2026-09-04-007421-a",
    title: "Комплект паливних форсунок Cummins",
    customer: "КП «Харківпастранс»",
    category: "Двигуни",
    topCategory: "Запчастини",
    budget: 1890000,
    deadline: "11.10.2026",
    region: "Харків",
    priority: "A",
    score: 84,
    status: "Новий",
    manager: "—",
    stage: "Аналіз",
    recommendation: "Швидкий аналіз каталожних номерів",
  },
  {
    id: "UA-2026-08-31-001209-a",
    title: "Фільтри мастильні та повітряні",
    customer: "КП «Дніпроводоканал»",
    category: "Фільтри",
    topCategory: "Запчастини",
    budget: 980000,
    deadline: "16.10.2026",
    region: "Дніпро",
    priority: "B",
    score: 76,
    status: "Новий",
    manager: "—",
    stage: "Аналіз",
    recommendation: "Перевірити мінімальну маржу",
  },
  {
    id: "UA-2026-09-01-008118-a",
    title: "Ремонт бурового обладнання",
    customer: "АТ «Укрнафта»",
    category: "Бурове",
    topCategory: "Сервіс і роботи",
    budget: 8400000,
    deadline: "20.10.2026",
    region: "Івано-Франківськ",
    priority: "B",
    score: 71,
    status: "Новий",
    manager: "—",
    stage: "Аналіз",
    recommendation: "Потрібен партнер із сервісною командою",
  },
  {
    id: "UA-2026-08-26-006813-a",
    title: "Підшипники промислові SKF",
    customer: "ДП «НАЕК Енергоатом»",
    category: "Запчастини",
    topCategory: "Запчастини",
    budget: 3240000,
    deadline: "13.10.2026",
    region: "Рівне",
    priority: "A",
    score: 88,
    status: "Проаналізовано",
    manager: "—",
    stage: "Аналіз",
    recommendation: "Брати в роботу",
  },
  {
    id: "UA-2026-09-04-000892-a",
    title: "Технічне обслуговування спецтехніки",
    customer: "КП «Одесміськелектротранс»",
    category: "Технічний сервіс",
    topCategory: "Сервіс і роботи",
    budget: 1450000,
    deadline: "19.10.2026",
    region: "Одеса",
    priority: "C",
    score: 46,
    status: "Відхилено",
    manager: "—",
    stage: "Аналіз",
    recommendation: "Низька відповідність регіону",
  },
];

export const money = (n: number) =>
  new Intl.NumberFormat("uk-UA").format(n) + " грн";
export const nav = [
  ["/dashboard", "Головна"],
  ["/tenders", "Тендери"],
  ["/categories", "Категорії"],
  ["/customers", "Замовники"],
  ["/analytics", "Аналітика"],
  ["/export", "Експорт"],
  ["/settings", "Налаштування"],
] as const;
