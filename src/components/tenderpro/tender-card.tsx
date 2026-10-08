import {
  expectedValueLabel,
  vatLabel,
  subjectWithUnits,
  workspaceZakupivliURL,
} from "@/lib/tender-presentation";
import { DocumentViewer } from "./document-viewer";
import { LotDetails, QuestionsDetails } from "./tender-source-details";
import { worksheetValue } from "@/lib/worksheet-model";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  ExternalLink,
  FileText,
  Download,
  Sparkles,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { money, type Tender } from "@/lib/demo-data";
import { useDemo } from "@/lib/demo-store";
import {
  fullDate,
  periodInfo,
  statusLabel,
  statusTone,
} from "@/lib/tender-workflow";
import { prozorroLink } from "@/lib/worksheet-model";
import type { DetailFlow, DetailDocument } from "@/lib/tender-detail";
import { periodRange } from "@/lib/tender-period";

const tabs = [
  "Огляд",
  "AI аналіз",
  "Документи",
  "Вимоги",
  "Звернення",
  "Історія",
];
export function TenderCard({
  tender: t,
  flow,
}: {
  tender: Tender;
  flow: DetailFlow;
}) {
  const { saveComment, documentAction, now } = useDemo();
  const [note, setNote] = useState(t.comment ?? "");
  const [preview, setPreview] = useState<DetailDocument | null>(null);
  const [analysis, setAnalysis] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pending = useRef<string | null>(null);
  const saveRef = useRef(saveComment);
  saveRef.current = saveComment;
  const flush = () => {
    clearTimeout(timer.current);
    if (pending.current !== null) {
      saveRef.current(t.id, pending.current);
      pending.current = null;
    }
  };
  useEffect(() => {
    setNote(t.comment ?? "");
  }, [t.id, t.comment]);
  useEffect(() => {
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, [t.id]);
  const changeNote = (text: string) => {
    setNote(text);
    pending.current = text;
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, 750);
  };
  const period = periodInfo(t, now);
  const textFor = (doc: DetailDocument) =>
    [
      "TenderPro · текст джерела",
      doc.name,
      t.title,
      t.id,
      "",
      doc.text,
      "",
      ...doc.facts,
      "",
      ...doc.sources,
    ].join("\n");
  const download = (doc: DetailDocument) => {
    // This action is explicitly an analysis text extract, separate from the original.
    const url = URL.createObjectURL(
      new Blob([textFor(doc)], { type: "text/plain;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = doc.name + ".txt";
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    documentAction(t.id, doc.name, "downloaded");
  };
  const fields: [string, ReactNode][] = [
    ["Назва", t.title],
    ["ID", t.id],
    ["Замовник", t.customer],
    ["Код замовника", t.hierarchy?.customerCode ?? "-"],
    ["Категорія", t.category],
    ["CPV", t.cpv ?? "-"],
    ["Офіційна назва", t.officialTitle ?? "-"],
    ["Статус Prozorro", t.prozorroStatus ?? "-"],
    ["Предмет закупівлі", subjectWithUnits(t)],
    [
      "Очікувана вартість",
      <>
        <span>{expectedValueLabel(t)}</span>
        <br />
        <small>{vatLabel(t.vatIncluded)}</small>
      </>,
    ],
    ["Кількість", worksheetValue(t, "quantity", 0, now)],
    ["Од. виміру", t.unit ?? "-"],
    [
      "Ціна за одиницю",
      t.unitPrice === undefined ? "-" : money(t.unitPrice, t.currency),
    ],
    ["Аукціон", worksheetValue(t, "auctionPeriod", 0, now)],
    ["Поставка", worksheetValue(t, "deliveryPeriod", 0, now)],
    ["Адреса", worksheetValue(t, "address", 0, now)],
    ["Дата публікації", t.publishedAt ? fullDate(t.publishedAt) : "-"],
    ["Дедлайн", t.deadline],
    ["Залишилось", period.label],
    ["Тип процедури", "-"],
    ["Регіон", t.region],
  ];
  return (
    <article className="tender-card">
      <Link className="tender-back" to="/tenders" onClick={flush}>
        <ArrowLeft size={16} /> До таблиці
      </Link>
      <header className="tender-card-header">
        <div>
          <p className="tender-card-id">{t.id}</p>
          <h1>{t.title}</h1>
          <p>{t.customer}</p>
        </div>
        <div className="tender-card-keyfacts">
          <div className={`sheet-period period-${period.tone}`}>
            <span>
              {fullDate(period.start)} → <strong>{t.deadline}</strong>
            </span>
            <small>{period.label}</small>
          </div>
          <div>
            <strong>{expectedValueLabel(t)}</strong>
            <br />
            <small>{vatLabel(t.vatIncluded)}</small>
          </div>
          <a
            className="tender-workspace-link"
            href={workspaceZakupivliURL(t)}
            target="_blank"
            rel="noreferrer"
          >
            Відкрити в Zakupivli.pro <ExternalLink size={15} />
          </a>
          <a href={prozorroLink(t)} target="_blank" rel="noreferrer">
            Джерело Prozorro <ExternalLink size={15} />
          </a>
        </div>
      </header>
      <Tabs defaultValue="Огляд" className="tender-card-tabs">
        <TabsList>
          {tabs.map((tab) => (
            <TabsTrigger key={tab} value={tab}>
              {tab}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="Огляд">
          <section className="tender-card-section">
            <h2>Відомості про закупівлю</h2>
            <dl className="tender-card-fields">
              {fields.map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
              <div>
                <dt>Посилання</dt>
                <dd>
                  <a href={prozorroLink(t)} target="_blank" rel="noreferrer">
                    Джерело Prozorro ↗
                  </a>
                </dd>
              </div>
              <div>
                <dt>Автоматичний статус</dt>
                <dd>
                  <span
                    className={`sheet-auto-status tone-${statusTone(t.status)}`}
                  >
                    {statusLabel(t.status)}
                  </span>
                  {t.statusRecalcAt && (
                    <small className="tender-card-muted">
                      Перерахунок коментаря заплановано
                    </small>
                  )}
                </dd>
              </div>
            </dl>
            {(t.hierarchy?.lots.length ?? 0) > 0 && (
              <>
                <h2>Лоти · {t.hierarchy!.lots.length}</h2>
                <LotDetails tender={t} />
              </>
            )}
            {(t.hierarchy?.items.filter((i) => !i.lotId).length ?? 0) > 0 && (
              <details>
                <summary>Позиції без лота</summary>
                <ul>
                  {t
                    .hierarchy!.items.filter((i) => !i.lotId)
                    .map((i) => (
                      <li key={i.id}>
                        {i.description ?? "-"} · {i.quantity ?? "-"}{" "}
                        {i.unit ?? "-"} · CPV {i.cpv ?? "-"} ·{" "}
                        {periodRange(i.delivery ?? undefined)} ·{" "}
                        {i.address ?? "-"}
                      </li>
                    ))}
                </ul>
              </details>
            )}
            <label className="tender-card-comment">
              Коментар користувача
              <textarea
                value={note}
                onChange={(e) => changeNote(e.target.value)}
                onBlur={flush}
                placeholder="Додати коментар…"
              />
            </label>
            <p className="tender-card-muted">
              Автозбереження. Статус визначається системою окремо.
            </p>
          </section>
        </TabsContent>
        <TabsContent value="Звернення">
          <QuestionsDetails tender={t} />
        </TabsContent>
        <TabsContent value="AI аналіз">
          <section className="tender-card-section">
            <h2>
              AI висновок <small>За наданими джерелами</small>
            </h2>
            <p className="tender-card-summary">{flow.summary}</p>
            <div className="tender-ai-metrics">
              <strong>
                {t.analysisPending || t.aiScore === null ? "-" : t.score}
                <small>/100 · AI score</small>
              </strong>
              <strong>
                {t.analysisPending || t.aiScore === null ? "-" : t.priority}
                <small>Пріоритет</small>
              </strong>
            </div>
            <div className="tender-card-columns">
              <SummaryList
                title="Причини"
                items={[t.recommendation, flow.checks]}
              />
              <SummaryList title="Ризики" items={flow.risks} />
              <SummaryList title="Рекомендовані дії" items={flow.plan} />
              <SummaryList title="Ключові вимоги" items={flow.requirements} />
            </div>
          </section>
        </TabsContent>
        <TabsContent value="Документи">
          <section className="tender-card-section">
            <h2>
              Документи <small>{flow.documents.length}</small>
            </h2>
            <p className="tender-card-muted">
              Документи відображаються лише за наданим джерелом. Якщо їх не
              імпортовано або не отримано, список порожній.
            </p>
            <div className="tender-document-list">
              {flow.documents.map((doc) => {
                const state = t.documentStates?.[doc.name];
                return (
                  <article key={doc.documentId ?? doc.name}>
                    <FileText size={21} />
                    <div className="tender-document-info">
                      <h3>{doc.name}</h3>
                      {doc.datePublished &&
                        t.publishedAt &&
                        doc.datePublished.slice(0, 10) >
                          t.publishedAt.slice(0, 10) && (
                          <small>Додано після публікації тендера</small>
                        )}
                      {(t.hierarchy?.documentVersions.filter(
                        (v) => v.documentId === doc.documentId,
                      ).length ?? 0) > 1 && (
                        <strong>Оновлено · кілька версій</strong>
                      )}
                      <details>
                        <summary>Історія версій</summary>
                        {t.hierarchy?.documentVersions
                          .filter((v) => v.documentId === doc.documentId)
                          .map((v) => (
                            <p key={v.versionId} className="break-all text-xs">
                              <a
                                href={v.sourceUrl}
                                target="_blank"
                                rel="noreferrer"
                              >
                                {v.name} ↗
                              </a>{" "}
                              · {v.dateModified ?? v.datePublished ?? "-"} ·{" "}
                              {v.parseStatus}
                              <br />
                              Версія: {v.versionId}
                              <br />
                              SHA256: {v.hash ?? "-"}
                            </p>
                          ))}
                      </details>
                      <p>
                        {doc.name.split(".").at(-1)?.toUpperCase()} ·{" "}
                        {doc.sizeBytes !== undefined
                          ? `${doc.sizeBytes.toLocaleString("uk-UA")} байт`
                          : "Розмір: -"}{" "}
                        · {doc.dateModified ? fullDate(doc.dateModified) : "-"}
                      </p>
                      <p>
                        Download: {doc.downloadStatus ?? "unknown"} · Parse:{" "}
                        {doc.parseStatus ?? "unknown"}
                      </p>
                      {doc.error && <p>{doc.error}</p>}
                      {doc.url && (
                        <a href={doc.url} target="_blank" rel="noreferrer">
                          Оригінал документа ↗
                        </a>
                      )}
                    </div>
                    <div className="tender-document-actions">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setAnalysis(false);
                          setPreview(doc);
                        }}
                      >
                        Preview
                      </Button>
                      <Button variant="outline" size="sm" asChild>
                        <a
                          href={doc.sourceUrl ?? doc.url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <Download size={14} /> Завантажити оригінал
                        </a>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          documentAction(t.id, doc.name, "parsed");
                          setAnalysis(true);
                          setPreview(doc);
                        }}
                      >
                        <Sparkles size={14} /> AI аналіз
                      </Button>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        </TabsContent>
        <TabsContent value="Вимоги">
          <section className="tender-card-section">
            <h2>Структуровані вимоги</h2>
            <h3>Технічні вимоги</h3>
            {flow.parts.length ? (
              <div className="tender-requirement-scroll">
                <table className="tender-requirements">
                  <thead>
                    <tr>
                      {[
                        "Каталожний номер",
                        "Бренд",
                        "Найменування",
                        "Кількість",
                        "Аналоги / відповідність",
                      ].map((label) => (
                        <th key={label}>{label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {flow.parts.map((p) => (
                      <tr key={p.code}>
                        <td>
                          <strong>{p.code}</strong>
                        </td>
                        <td>{p.brand}</td>
                        <td>{p.name}</td>
                        <td>{p.qty} шт.</td>
                        <td>
                          {p.match} · {p.status}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <dl className="tender-card-fields">
                {flow.technical.map(([label, value]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
            )}
            {flow.parts.length > 0 && (
              <SummaryList
                title="Додаткові технічні вимоги"
                items={(t.technicalRequirements ?? []).filter(
                  (text) =>
                    !flow.parts.some((part) => text.includes(part.code)),
                )}
              />
            )}
            <SummaryList
              title="Кваліфікаційні вимоги"
              items={t.qualificationRequirements ?? []}
            />
            <SummaryList
              title="Особливі вимоги"
              items={t.specialRequirements ?? []}
            />
            <p className="tender-card-muted">
              Вимоги взято з поточного тендера; невідомі параметри потребують
              уточнення.
            </p>
          </section>
        </TabsContent>
        <TabsContent value="Історія">
          <section className="tender-card-section">
            <h2>Історія дій</h2>
            {t.history?.length ? (
              <ol className="tender-history">
                {[...t.history].reverse().map((event, index) => (
                  <li key={`${event.at}-${index}`}>
                    <time>
                      {new Date(event.at).toLocaleString("uk-UA", {
                        timeZone: "Europe/Kyiv",
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </time>
                    <span>
                      {event.text}
                      {event.from && event.to && (
                        <strong>
                          {statusLabel(event.from)} → {statusLabel(event.to)}
                        </strong>
                      )}
                    </span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="tender-card-muted">
                Нові дії зберігатимуться локально. Історію до цього сеансу не
                надано.
              </p>
            )}
          </section>
        </TabsContent>
      </Tabs>
      <Dialog
        open={!!preview}
        onOpenChange={(open) => {
          if (!open) setPreview(null);
        }}
      >
        <DialogContent className="tender-document-modal">
          <DialogHeader>
            <DialogTitle>{preview?.name}</DialogTitle>
            <DialogDescription>
              {analysis
                ? "Результат аналізу джерела"
                : "Перегляд оригінального документа"}
            </DialogDescription>
          </DialogHeader>
          {preview && (
            <div className="tender-document-preview">
              {analysis ? (
                <SummaryList title="Ключові факти" items={[...preview.facts]} />
              ) : (
                <DocumentViewer tenderId={t.id} document={preview} />
              )}
              <SummaryList title="Джерела" items={[...preview.sources]} />
              {analysis && (
                <Button variant="outline" onClick={() => download(preview)}>
                  Завантажити витяг для аналізу (.txt)
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </article>
  );
}
function SummaryList({
  title,
  items,
}: {
  title: string;
  items: readonly string[];
}) {
  return (
    <section className="tender-summary-list">
      <h3>{title}</h3>
      <ul>
        {items.map((text, i) => (
          <li key={i}>{text}</li>
        ))}
      </ul>
    </section>
  );
}
