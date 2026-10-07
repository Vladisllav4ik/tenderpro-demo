import type { Tender } from "./demo-data";
import { periodInfo, statusTone } from "./tender-workflow.ts";
import {
  prozorroLink,
  worksheetFilename,
  worksheetValue,
  type ExportColumn,
  commentFill,
} from "./worksheet-model.ts";

const colors: Record<string, { fill: string; text: string }> = {
  blue: { fill: "DCECFF", text: "0758D5" },
  green: { fill: "D1F6E5", text: "145B47" },
  yellow: { fill: "FFF0B5", text: "6A5017" },
  red: { fill: "FFE0E1", text: "A02B38" },
  orange: { fill: "F8E4CD", text: "93602F" },
  gray: { fill: "E4E7EB", text: "646D77" },
};
export async function createWorksheetWorkbook(
  items: Tender[],
  columns: ExportColumn[],
  zoom = 100,
  now = new Date(),
) {
  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "TenderPro";
  workbook.created = now;
  let frozen = 0;
  for (const c of columns) {
    if (c.pinned ?? frozen < 2) frozen++;
    else break;
  }
  const sheet = workbook.addWorksheet("Тендери", {
    views: [{ state: "frozen", xSplit: frozen, ySplit: 1 }],
  });
  sheet.columns = columns.map((c) => ({
    header: c.label === "↗" ? "Посилання" : c.label,
    key: c.key,
    width: Math.max(5, (c.width - 5) / 7),
  }));
  const scale = zoom / 100;
  sheet.getRow(1).height = 36 * scale;
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: columns.length },
  };
  items.forEach((t, index) => {
    const row = sheet.addRow(
      columns.map((c) =>
        c.key === "id"
          ? { text: t.id, hyperlink: prozorroLink(t) }
          : worksheetValue(t, c.key, index, now),
      ),
    );
    row.height = 48 * scale;
    row.eachCell((cell, columnNumber) => {
      const column = columns[columnNumber - 1]!;
      cell.font = {
        name: "Calibri",
        size: 11 * scale,
        color: { argb: "FF172033" },
      };
      cell.alignment = {
        vertical: "middle",
        wrapText: true,
        horizontal: ["number", "score", "quantity", "unit"].includes(column.key)
          ? "center"
          : "left",
      };
      cell.border = {
        top: { style: "thin", color: { argb: "FF8B919A" } },
        bottom: { style: "thin", color: { argb: "FF8B919A" } },
        left: { style: "thin", color: { argb: "FF8B919A" } },
        right: { style: "thin", color: { argb: "FF8B919A" } },
      };
      let color =
        column.key === "status"
          ? colors[statusTone(t.status)]
          : column.key === "score"
            ? colors[
                t.analysisPending
                  ? "gray"
                  : t.score >= 80
                    ? "green"
                    : t.score >= 50
                      ? "yellow"
                      : "red"
              ]
            : undefined;
      if (column.key === "topCategory" || column.key === "number")
        color = { fill: "F0F3F7", text: "53637C" };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: {
          argb: `FF${color?.fill ?? (index % 2 ? "F9FBFE" : "FFFFFF")}`,
        },
      };
      if (color)
        cell.font = { ...cell.font, color: { argb: `FF${color.text}` } };
      if (column.key === "comment" && commentFill(t.commentColor))
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FF" + commentFill(t.commentColor) },
        };
      if (column.key === "period") {
        const period = periodInfo(t, now);
        cell.font = {
          ...cell.font,
          bold: true,
          color: {
            argb:
              period.tone === "expired"
                ? "FF8B7278"
                : period.tone === "red"
                  ? "FFA02B38"
                  : period.tone === "orange"
                    ? "FFB26816"
                    : "FF172033",
          },
        };
      }
      if (column.key === "id")
        cell.font = {
          ...cell.font,
          color: { argb: "FF0758D5" },
          underline: true,
        };
      if (column.key === "budget" || column.key === "unitPrice")
        cell.numFmt = t.currency === "UAH" ? '#,##0.##" ₴"' : "#,##0.##";
    });
  });
  sheet.getRow(1).eachCell((cell) => {
    cell.font = {
      name: "Calibri",
      size: 11 * scale,
      bold: true,
      color: { argb: "FFFFFFFF" },
    };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF202935" },
    };
    cell.alignment = { vertical: "middle", wrapText: true };
    cell.border = { bottom: { style: "thin", color: { argb: "FF39465B" } } };
  });
  sheet.pageSetup = {
    orientation: "landscape",
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
  };
  return workbook;
}
export async function downloadWorksheet(
  items: Tender[],
  columns: ExportColumn[],
  zoom: number,
  now: Date,
) {
  const workbook = await createWorksheetWorkbook(items, columns, zoom, now);
  const buffer = await workbook.xlsx.writeBuffer();
  const bytes = new Uint8Array(buffer);
  const url = URL.createObjectURL(
    new Blob([bytes], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = worksheetFilename(items, now);
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
