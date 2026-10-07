import { useEffect, useState } from "react";
import type { DetailDocument } from "@/lib/tender-detail";
import type { DocumentPreview } from "@/lib/document-preview";
export function DocumentPreviewView({
  preview,
  document,
}: {
  preview: DocumentPreview | null;
  document: DetailDocument;
}) {
  const [url, setURL] = useState("");
  const [sheet, setSheet] = useState(0);
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState(100);
  useEffect(() => {
    if (!preview?.base64) {
      setURL("");
      return;
    }
    const bytes = Uint8Array.from(atob(preview.base64), (c) => c.charCodeAt(0));
    const local = URL.createObjectURL(
      new Blob([bytes], {
        type: preview.mimeType ?? "application/octet-stream",
      }),
    );
    setURL(local);
    return () => URL.revokeObjectURL(local);
  }, [preview]);
  const original = preview?.originalUrl ?? document.sourceUrl ?? document.url;
  return (
    <div className="document-viewer">
      <div className="document-viewer-toolbar">
        <span>
          {document.mimeType ?? document.name.split(".").at(-1)?.toUpperCase()}{" "}
          ·{" "}
          {preview?.sizeBytes !== undefined
            ? `${preview.sizeBytes.toLocaleString("uk-UA")} байт`
            : "Розмір: -"}{" "}
          · Parse: {document.parseStatus ?? "unknown"}
        </span>
        {original && (
          <>
            <a href={original} target="_blank" rel="noreferrer">
              Відкрити оригінал ↗
            </a>
            <a
              href={url || original}
              download={url ? document.name : undefined}
              target={url ? undefined : "_blank"}
              rel="noreferrer"
            >
              Завантажити оригінал
            </a>
          </>
        )}
      </div>
      {!preview && <p role="status">Готуємо preview…</p>}
      {preview?.notice && (
        <p className="document-viewer-notice">{preview.notice}</p>
      )}
      {preview?.previewType === "pdf" && url && (
        <>
          <div className="document-viewer-toolbar">
            <label>
              Сторінка{" "}
              <input
                aria-label="Сторінка PDF"
                type="number"
                min={1}
                value={page}
                onChange={(e) =>
                  setPage(Math.max(1, Number(e.target.value) || 1))
                }
              />
            </label>
            <label>
              Масштаб{" "}
              <select
                aria-label="Масштаб PDF"
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
              >
                {[50, 75, 100, 125, 150, 200].map((n) => (
                  <option key={n} value={n}>
                    {n}%
                  </option>
                ))}
              </select>
            </label>
          </div>
          <iframe
            className="document-pdf"
            title={`PDF: ${document.name}`}
            src={`${url}#toolbar=1&page=${page}&zoom=${zoom}`}
          />
        </>
      )}
      {preview?.previewType === "html" && (
        <div
          className="document-html"
          dangerouslySetInnerHTML={{ __html: preview.html ?? "" }}
        />
      )}
      {preview?.previewType === "spreadsheet" && (
        <>
          <div
            className="document-viewer-toolbar"
            role="group"
            aria-label="Аркуші документа"
          >
            {preview.sheets?.map((s, i) => (
              <button
                type="button"
                key={s.name}
                aria-pressed={sheet === i}
                onClick={() => setSheet(i)}
              >
                {s.name}
              </button>
            ))}
          </div>
          {preview.sheets?.[sheet]?.truncated && (
            <p>
              Preview обмежено 2000 рядками / 100 колонками. Повний аркуш
              доступний в оригіналі.
            </p>
          )}
          <div className="document-spreadsheet">
            <table>
              <tbody>
                {preview.sheets?.[sheet]?.rows.map((row, r) => (
                  <tr key={r}>
                    <th scope="row">{r + 1}</th>
                    {row.map((cell, c) => (
                      <td key={c}>{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {preview?.previewType === "text" && (
        <pre className="document-text">{preview.text}</pre>
      )}
      {preview?.previewType === "image" && url && (
        <img className="document-image" src={url} alt={document.name} />
      )}
    </div>
  );
}
