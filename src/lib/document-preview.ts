export type DocumentPreview = {
  previewType:
    "pdf" | "html" | "spreadsheet" | "text" | "image" | "unsupported";
  sizeBytes?: number;
  mimeType?: string;
  originalUrl?: string;
  base64?: string;
  html?: string;
  text?: string;
  sheets?: { name: string; rows: string[][]; truncated: boolean }[];
  notice?: string | undefined;
};
