import type { Tender } from "../demo-data.ts";
import { recalculateTender, recordEvent } from "../tender-workflow.ts";
import { tableTender } from "../worksheet-model.ts";
import { shortSubject } from "../tender-subject.ts";
import type {
  AgentService,
  FilterResult,
  StatusResult,
  TenderSourceConnector,
} from "./contracts.ts";
export class MockTenderSourceConnector implements TenderSourceConnector {
  async collect({ records, limit }: { records: Tender[]; limit: number }) {
    // Provided source records only. Future Prozorro connector implements this contract.
    return structuredClone(records.slice(0, limit));
  }
}
export class CollectorAgentService implements AgentService<Tender[], Tender[]> {
  private connector: TenderSourceConnector;
  private limit: number;
  constructor(
    connector: TenderSourceConnector = new MockTenderSourceConnector(),
    limit = 100,
  ) {
    this.connector = connector;
    this.limit = limit;
  }
  execute(records: Tender[]) {
    return this.connector.collect({ records, limit: this.limit });
  }
}
export class FilterAgentService implements AgentService<Tender, FilterResult> {
  async execute(t: Tender): Promise<FilterResult> {
    const text = [
      t.title,
      t.subject,
      t.description,
      ...(t.objects ?? []).map((o) => o.name),
      ...(t.documents ?? []).map((d) => d.text),
    ].join(" ");
    const excluded =
      /харчув|медич|лікарськ|будівельні роботи|ремонт доріг/i.test(text);
    const groups: [RegExp, string, Tender["topCategory"]][] = [
      [/запчаст|фільтр|підшипник/i, "Запчастини", "Запчастини"],
      [/xcmg|dongfeng|автокран|самоскид|екскаватор/i, "Техніка", "Техніка"],
      [/обладнан|генератор|трансформатор/i, "Обладнання", "Обладнання"],
      [/метал|матеріал/i, "Матеріали", "Матеріали"],
      [/палив|мастил/i, "Паливо", "Паливо"],
      [/сервіс|обслуговуван/i, "Послуги", "Сервіс і роботи"],
    ];
    const group = groups.find(([pattern]) => pattern.test(text));
    const describedSubject = [
      t.description ?? "",
      ...(t.documents ?? []).map((d) => d.text),
    ]
      .join("\n")
      .match(/Предмет закупівлі:\s*([^\n.]+)/i)?.[1];
    const subject = shortSubject(
      t.objects?.map((o) => o.name).join("; ") ||
        describedSubject ||
        t.subject ||
        t.title,
      t.objects,
    );
    const title =
      /^(закупівля|тендер|товари|лот)(\s*\d+)?$/i.test(t.title.trim()) &&
      subject !== t.title
        ? subject
        : t.title;
    return {
      accepted: !excluded,
      reason: excluded
        ? "Не відповідає профілю компанії (mock-фільтр)"
        : "Потрібна перевірка директором; результат mock-фільтра",
      tender: {
        ...t,
        title,
        subject,
        category: group?.[1] ?? "Інше",
        topCategory: group?.[2] ?? "Інше",
        relevance: excluded ? "rejected" : "accepted",
        relevanceReason: excluded
          ? "Не відповідає профілю компанії (mock-фільтр)"
          : "Пройдено mock-фільтр; потрібна перевірка директором",
      },
    };
  }
}
export class DetailAgentService implements AgentService<Tender, Tender> {
  async execute(t: Tender): Promise<Tender> {
    const data = tableTender(t);
    const summary = `Mock-розбір: ${shortSubject(data.subject || data.title, data.objects)}. Структуровано надані дані; документи без тексту не аналізувались.`;
    const analysis = {
      parts: t.analysis?.parts ?? [],
      technical: (data.technicalRequirements ?? []).map((value, i) => [
        `Вимога ${i + 1}`,
        value,
      ]),
      documents: t.documents ?? [],
      summary,
      checks: "-",
      requirements: [
        ...(data.technicalRequirements ?? []),
        ...(data.qualificationRequirements ?? []),
        ...(data.specialRequirements ?? []),
      ],
      risks: t.risks ?? [],
      plan: [],
      delivery: data.deliveryPeriod?.text ?? "-",
    };
    return recordEvent(
      {
        ...data,
        totalAmount: data.budget,
        cpv: t.cpv ?? null,
        analysisPending: false,
        analysis,
        documents: analysis.documents,
        aiSummary: summary,
        risks: analysis.risks,
        aiScore: t.analysisPending || t.aiScore === null ? null : data.score,
        updatedAt: new Date().toISOString(),
      },
      "agent-detail",
      "Виконано mock-розбір без реального AI",
    );
  }
}
export class StatusAgentService implements AgentService<Tender, StatusResult> {
  async execute(t: Tender): Promise<StatusResult> {
    const next = recalculateTender(t);
    return {
      recommendedStatus: next.status,
      reason:
        next.lifecycle?.reason ??
        next.history?.at(-1)?.text ??
        "Змін життєвого циклу немає",
      confidence: 1,
      eventType:
        next.status === t.status
          ? "unchanged"
          : (next.statusOrigin ?? "lifecycle"),
      tender: {
        ...next,
        commentColor: t.commentColor ?? "none",
        statusHistory: next.history ?? [],
      },
    };
  }
}
