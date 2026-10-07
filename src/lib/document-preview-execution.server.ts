import { requireAccount } from "./session.server";
import { crashRepository } from "./agents/crash-repository.server";
import { TenderDocumentService } from "./agents/document-service.server";
import { renderDocumentPreview } from "./document-preview.server";
export async function documentPreview(data: {
  tenderId: string;
  documentId: string;
}) {
  const account = requireAccount();
  if (
    !data ||
    typeof data.tenderId !== "string" ||
    typeof data.documentId !== "string"
  )
    throw new Error("Некоректний документ.");
  const record = (
    await crashRepository.list(
      account.role === "ADMIN" ? undefined : account.id,
    )
  ).find((r) => r.rawImportedData.id === data.tenderId);
  const doc = record?.preparation?.documents.find(
    (d) => d.documentId === data.documentId,
  );
  if (!doc) throw new Error("Документ недоступний.");
  try {
    const bytes = await new TenderDocumentService().downloadDocument({
      ...doc,
    });
    return {
      ...(await renderDocumentPreview(bytes, doc.name, doc.mimeType)),
      originalUrl: doc.url,
    };
  } catch {
    return {
      previewType: "unsupported" as const,
      originalUrl: doc.url,
      notice: "Не вдалося підготувати preview. Відкрийте оригінал документа.",
    };
  }
}
