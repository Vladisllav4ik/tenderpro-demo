export type Tender = {
  crashRecordId?: string;
  sourceFields?: string[];
  rawImport?: {
    fileName: string;
    row: number;
    cells: Record<string, string | number | boolean | null>;
  };
  provenance?: Record<
    string,
    {
      source:
        "import" | "prozorro" | "document" | "agent2" | "agent3" | "agent4";
      evidence?: string;
      sourceId?: string;
      confidence?: number;
    }
  >;
  currency?: string;
  expectedValue?: number | null;
  vatIncluded?: boolean | null;
  sourceUrlProzorro?: string;
  workspaceUrlZakupivli?: string;
  officialTitle?: string;
  prozorroStatus?: string;
  sourceItems?: import("./agents/contracts.ts").JsonValue[];
  sourceLots?: import("./agents/contracts.ts").JsonValue[];
  subject?: string;
  cpv?: string | null;
  totalAmount?: number;
  documents?: readonly import("./tender-detail").DetailDocument[];
  aiSummary?: string;
  risks?: string[];
  aiScore?: number | null;
  sourceUrl?: string;
  description?: string;
  relevance?: "accepted" | "rejected";
  relevanceReason?: string;
  analysis?: import("./tender-detail").DetailFlow;
  statusHistory?: NonNullable<Tender["history"]>;
  createdAt?: string | null;
  updatedAt?: string | null;
  id: string;
  title: string;
  customer: string;
  category: string;
  topCategory:
    | "Техніка"
    | "Запчастини"
    | "Обладнання"
    | "Матеріали"
    | "Паливо"
    | "Сервіс і роботи"
    | "Інше";
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

export const tenders: Tender[] = [];

export const money = (n: number, currency?: string) =>
  new Intl.NumberFormat("uk-UA").format(n) + (currency ? ` ${currency}` : "");
export const nav = [
  ["/dashboard", "Головна"],
  ["/tenders", "Тендери"],
  ["/categories", "Категорії"],
  ["/customers", "Замовники"],
  ["/analytics", "Аналітика"],
  ["/export", "Експорт"],
  ["/settings", "Налаштування"],
] as const;
