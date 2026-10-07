import { DocumentPreviewView } from "./document-preview-view";
import { useEffect, useState } from "react";
import type { DetailDocument } from "@/lib/tender-detail";
import type { DocumentPreview } from "@/lib/document-preview";
import { getDocumentPreview } from "@/lib/document-preview-client";

export function DocumentViewer({
  tenderId,
  document,
}: {
  tenderId: string;
  document: DetailDocument;
}) {
  const [preview, setPreview] = useState<DocumentPreview | null>(null);
  useEffect(() => {
    let active = true;
    setPreview(null);
    if (document.documentId) {
      getDocumentPreview({
        data: { tenderId, documentId: document.documentId },
      })
        .then((result) => {
          if (active) setPreview(result);
        })
        .catch(() => {
          if (active)
            setPreview({
              previewType: "unsupported",
              notice: "Preview недоступний. Відкрийте оригінал.",
            });
        });
    } else
      setPreview({
        previewType: "unsupported",
        notice: "Оригінал документа не надано.",
      });
    return () => {
      active = false;
    };
  }, [tenderId, document.documentId]);
  return (
    <DocumentPreviewView
      key={document.documentId ?? document.name}
      preview={preview}
      document={document}
    />
  );
}
