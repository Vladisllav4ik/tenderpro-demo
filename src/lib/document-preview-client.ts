import { createServerFn } from "@tanstack/react-start";
export const getDocumentPreview = createServerFn({ method: "GET" })
  .validator((data: { tenderId: string; documentId: string }) => data)
  .handler(async ({ data }) =>
    (await import("./document-preview-execution.server")).documentPreview(data),
  );
