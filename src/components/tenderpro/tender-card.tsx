import { useEffect, useRef, useState } from "react";
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

const tabs = ["Огляд", "AI аналіз", "Документи", "Вимоги", "Історія"];
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
      "TenderPro · демо-витяг",
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
    // Fixtures are extracted text, not the original procurement attachments.
    // Keep the real file format honest and label the downloadable local extract.
    const url = URL.createObjectURL(
      new Blob([textFor(doc)], { type: "text/plain;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = doc.name + ".demo.txt";
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    documentAction(t.id, doc.name, "downloaded");
  };
  const fields = [
    ["Назва", t.title],
    ["ID", t.id],
    ["Замовник", t.customer],
    ["Категорія", t.category],
    ["CPV", t.cpv ?? "-"],
    ["Предмет закупівлі", t.subject ?? "-"],
    ["Сума", money(t.budget)],
    ["Кількість", t.quantity ?? "-"],
    ["Од. виміру", t.unit ?? "-"],
    ["Ціна за одиницю", t.unitPrice === undefined ? "-" : money(t.unitPrice)],
    ["Аукціон", periodRange(t.auctionPeriod)],
    ["Поставка", periodRange(t.deliveryPeriod)],
    ["Адреса", t.address ?? "-"],
    [
      "Дата публікації",
      `${fullDate(period.start)}${t.publicationDateSource === "tender-id" ? " · з ID тендера" : ""}`,
    ],
    ["Дедлайн", t.deadline],
    ["Залишилось", period.label],
    ["Тип процедури", "Не зазначено в демо-джерелі"],
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
          <strong>{money(t.budget)}</strong>
          <a href={prozorroLink(t)} target="_blank" rel="noreferrer">
            Prozorro <ExternalLink size={15} />
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
                    Відкрити Prozorro ↗
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
        <TabsContent value="AI аналіз">
          <section className="tender-card-section">
            <h2>
              AI висновок <small>Демо-аналіз</small>
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
              Локальні демо-витяги. Завантаження повертає текст (.demo.txt);
              оригінали PDF / XLSX / DOCX доступні в Prozorro.
            </p>
            <div className="tender-document-list">
              {flow.documents.map((doc) => {
                const state = t.documentStates?.[doc.name];
                return (
                  <article key={doc.name}>
                    <FileText size={21} />
                    <div className="tender-document-info">
                      <h3>{doc.name}</h3>
                      <p>
                        {doc.name.split(".").at(-1)?.toUpperCase()} · витяг{" "}
                        {new Blob([textFor(doc)]).size.toLocaleString("uk-UA")}{" "}
                        байт · {fullDate(period.start)} (дата демо-джерела)
                      </p>
                      <p>
                        {state?.downloaded
                          ? "Витяг завантажено"
                          : "Витяг не завантажено"}{" "}
                        ·{" "}
                        {state?.parsed
                          ? "AI parsed ✓"
                          : "Демо-витяг розпізнано · AI аналіз не відкрито"}
                      </p>
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
                        Відкрити
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => download(doc)}
                      >
                        <Download size={14} /> Завантажити
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
                ? "Структурований AI аналіз · демо"
                : "Локальний демо-витяг документа"}
            </DialogDescription>
          </DialogHeader>
          {preview && (
            <div className="tender-document-preview">
              {analysis ? (
                <SummaryList title="Ключові факти" items={[...preview.facts]} />
              ) : (
                <pre>{preview.text}</pre>
              )}
              <SummaryList
                title="Джерела у демо"
                items={[...preview.sources]}
              />
              <Button variant="outline" onClick={() => download(preview)}>
                Завантажити демо-витяг (.txt)
              </Button>
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
