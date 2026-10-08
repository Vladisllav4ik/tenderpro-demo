import type { Tender } from "@/lib/demo-data";
import { money } from "@/lib/demo-data";
import { periodRange, formatPeriodDate } from "@/lib/tender-period";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
export function LotDetails({ tender: t }: { tender: Tender }) {
  return (
    <div className="space-y-3">
      {(t.hierarchy?.lots ?? []).map((lot, i) => (
        <section key={lot.id} className="rounded border p-3">
          <h3>
            Лот {i + 1}: {lot.title ?? "-"}
          </h3>
          <dl className="tender-card-fields">
            {[
              [
                "Очікувана вартість",
                lot.value === null
                  ? "-"
                  : money(lot.value, lot.currency ?? undefined),
              ],
              [
                "ПДВ",
                lot.vatIncluded === null
                  ? "-"
                  : lot.vatIncluded
                    ? "з ПДВ"
                    : "без ПДВ",
              ],
              ["Статус", lot.status ?? "-"],
              ["Подання", periodRange(lot.submission ?? undefined)],
              ["Аукціон", periodRange(lot.auction ?? undefined)],
              ["Поставка", periodRange(lot.delivery ?? undefined)],
              ["Адреса", lot.address ?? "-"],
            ].map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          <ul>
            {t.hierarchy?.items
              .filter((item) => item.lotId === lot.id)
              .map((item) => (
                <li key={item.id}>
                  {item.description ?? "-"} · {item.quantity ?? "-"}{" "}
                  {item.unit ?? "-"} · CPV {item.cpv ?? "-"}
                  <br />
                  Поставка: {periodRange(item.delivery ?? undefined)} ·{" "}
                  {item.address ?? "-"}
                </li>
              ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
export function LotIndicator({ tender: t }: { tender: Tender }) {
  const count = t.hierarchy?.lots.length ?? 0;
  if (count < 2) return null;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className="rounded border px-2 text-xs"
          aria-label={`Лоти: ${t.id}`}
        >
          {count} лоти
        </button>
      </PopoverTrigger>
      <PopoverContent className="sheet-detail-popover max-h-96 overflow-auto">
        <LotDetails tender={t} />
      </PopoverContent>
    </Popover>
  );
}
export function QuestionsDetails({ tender: t }: { tender: Tender }) {
  const questions = t.hierarchy?.questions ?? [];
  return (
    <section className="tender-card-section">
      <h2>
        Звернення <small>{questions.length}</small>
      </h2>
      {!questions.length && <p>Звернення відсутні у джерелі.</p>}
      {questions.map((q) => (
        <article key={q.id} className="mb-4 space-y-2 rounded border p-4">
          <h3>{q.title ?? "-"}</h3>
          <p className="text-sm">
            {formatPeriodDate(q.date ?? undefined)} · Лот: {q.lotId ?? "-"} ·
            Статус: {q.status ?? "-"}
          </p>
          <strong>Заява / запитання учасника</strong>
          <p className="whitespace-pre-wrap">{q.question ?? "-"}</p>
          <strong>Відповідь замовника</strong>
          <p className="whitespace-pre-wrap">{q.answer ?? "-"}</p>
          <p>{formatPeriodDate(q.answerDate ?? undefined)}</p>
          <p>
            AI classification: {q.classification ?? "-"} · Impact:{" "}
            {q.impact ?? "-"}
          </p>
          {q.changeClaimed && (
            <div>
              <p>Замовник заявив про зміну ТД</p>
              <p>
                Перевірка TenderPro:{" "}
                {q.changeVerified
                  ? "підтверджено реєстром документів"
                  : "не підтверджено"}
              </p>
              <ul>
                {q.verificationEvidence.map((e) => (
                  <li key={e} className="break-all text-xs">
                    {e}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <a href={q.sourceUrl} target="_blank" rel="noreferrer">
            Джерело Prozorro ↗
          </a>
        </article>
      ))}
    </section>
  );
}
