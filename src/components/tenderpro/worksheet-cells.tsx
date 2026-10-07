import { Palette } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useDemo } from "@/lib/demo-store";
import type { Tender } from "@/lib/demo-data";
import { periodInfo } from "@/lib/tender-workflow";
import { formatPeriodDate, periodRange } from "@/lib/tender-period";
import {
  commentPalette,
  objectLabel,
  worksheetValue,
  type ColumnKey,
} from "@/lib/worksheet-model";

export function CommentPalette({ tender: t }: { tender: Tender }) {
  const { setCommentColor } = useDemo();
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className="sheet-color-control"
          aria-label={`Колір коментаря: ${t.title}`}
          title="Ручний колір коментаря"
        >
          <Palette size={13} />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="sheet-color-control sheet-color-palette"
        align="start"
      >
        <p>Колір комірки «Коментар»</p>
        <div role="group" aria-label="Палітра коментаря">
          {commentPalette.map((color) => (
            <button
              key={color.value}
              title={color.label}
              aria-label={color.label}
              aria-pressed={(t.commentColor ?? "none") === color.value}
              onClick={() => setCommentColor(t.id, color.value)}
              style={{ background: color.fill ? `#${color.fill}` : "white" }}
            >
              {color.value === "none" ? "×" : ""}
            </button>
          ))}
        </div>
        <small>Текст і статус незалежні від кольору</small>
      </PopoverContent>
    </Popover>
  );
}
export function ObjectsCell({
  tender: t,
  zoom,
}: {
  tender: Tender;
  zoom: number;
}) {
  const objects = t.objects ?? [];
  const item = objects.length === 1 ? objects[0] : undefined;
  const parameters = item
    ? [
        ...(item.quantity !== undefined
          ? [`${item.quantity} ${item.unit ?? ""}`]
          : []),
        ...(item.characteristics ?? [])
          .slice(0, 3)
          .map((value) =>
            value
              .replace(/^Вантажопідйомність:\s*/i, "")
              .replace(/^Основна стріла:\s*/i, "стріла "),
          ),
      ].join(" · ")
    : "";
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className="sheet-objects-preview"
          aria-label={`Предмет закупівлі: ${t.title}`}
        >
          {item ? (
            <span title={objectLabel(item)}>
              <span className="sheet-subject-name">
                {item.name.replace(/\s+або\s+.*$/iu, "")}
              </span>
              {parameters && (
                <span className="sheet-subject-params">{parameters}</span>
              )}
            </span>
          ) : (
            <span className="sheet-two-lines">
              {objects
                .slice(0, 2)
                .map((object) =>
                  [
                    object.name,
                    object.quantity !== undefined
                      ? `${object.quantity} ${object.unit ?? ""}`
                      : "",
                  ]
                    .filter(Boolean)
                    .join(" · "),
                )
                .join("\n") || "-"}
            </span>
          )}
          {objects.length > 2 && <small>+{objects.length - 2}</small>}
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="sheet-detail-popover"
        style={{ fontSize: (13 * zoom) / 100 }}
        align="start"
      >
        <h3>Предмет закупівлі · {objects.length}</h3>
        <ul>
          {objects.map((object, i) => (
            <li key={i}>{objectLabel(object)}</li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
export function SubmissionCell({
  tender: t,
  now,
  zoom,
}: {
  tender: Tender;
  now: Date;
  zoom: number;
}) {
  const p = periodInfo(t, now);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className={`sheet-period sheet-submission period-${p.tone}`}
          aria-label={`Період подання: ${t.title}`}
        >
          <span>{p.startLabel}</span>
          <strong>{p.endLabel}</strong>
          <small>{p.label}</small>
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="sheet-detail-popover sheet-timeline"
        style={{ fontSize: (13 * zoom) / 100 }}
        align="start"
      >
        <h3>Строки закупівлі</h3>
        <dl>
          {[
            ["Дата публікації", formatPeriodDate(t.publishedAt)],
            ["Початок прийому", p.startLabel],
            ["Кінець подання", p.endLabel],
            ["Аукціон", periodRange(t.auctionPeriod)],
            ["Поставка", periodRange(t.deliveryPeriod)],
            ["Залишок", p.label],
          ].map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
        {!p.precise && (
          <small>Точний час подання не надано в демо-джерелі.</small>
        )}
      </PopoverContent>
    </Popover>
  );
}
export function DetailCell({
  tender: t,
  column,
  now,
  zoom,
}: {
  tender: Tender;
  column: ColumnKey;
  now: Date;
  zoom: number;
}) {
  const value = String(worksheetValue(t, column, 0, now));
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="sheet-detail-preview sheet-two-lines" title={value}>
          {value}
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="sheet-detail-popover"
        style={{ fontSize: (13 * zoom) / 100 }}
        align="start"
      >
        <p className="sheet-preserve-lines">{value}</p>
      </PopoverContent>
    </Popover>
  );
}
