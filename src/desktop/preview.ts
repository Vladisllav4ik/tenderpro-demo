import type { DocumentPreview } from "../lib/document-preview";
export async function getDocumentPreview(): Promise<DocumentPreview> {
  return {
    previewType: "unsupported",
    notice: "Документний backend ще не перенесено в Desktop Foundation.",
  };
}
