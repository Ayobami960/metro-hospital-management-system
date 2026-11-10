import ExcelJS from "exceljs";

export type CellValue = string | number | boolean | Date | null | undefined;

export interface ExportColumn<T> {
  header: string;
  key: string;
  width?: number;
  /** Numeric columns keep their type so Excel does not turn money into text. */
  value: (row: T) => CellValue;
}

export interface ExportDataset<T> {
  sheetName: string;
  columns: Array<ExportColumn<T>>;
  rows: T[];
}

const FORMULA_PREFIX = /^[=+\-@\t\r]/;

/**
 * CSV cells are escaped per RFC 4180, and values that begin with a formula
 * trigger are prefixed with an apostrophe. Patient names and free-text notes
 * are attacker-controlled; a spreadsheet must never evaluate them.
 */
export const csvCell = (value: CellValue): string => {
  if (value === null || value === undefined) return "";
  let text: string;
  if (value instanceof Date) text = value.toISOString();
  else if (typeof value === "boolean") text = value ? "true" : "false";
  else text = String(value);

  if (FORMULA_PREFIX.test(text)) text = `'${text}`;
  if (/[",\r\n]/.test(text)) text = `"${text.replace(/"/g, '""')}"`;
  return text;
};

export const buildCsv = <T>(dataset: ExportDataset<T>): Buffer => {
  const lines = [
    dataset.columns.map((column) => csvCell(column.header)).join(","),
    ...dataset.rows.map((row) =>
      dataset.columns.map((column) => csvCell(column.value(row))).join(","),
    ),
  ];
  // UTF-8 BOM keeps Excel from mangling accented names; CRLF is RFC 4180.
  return Buffer.from(`\uFEFF${lines.join("\r\n")}\r\n`, "utf8");
};

const safeSheetName = (name: string): string =>
  (name.replace(/[\\/*?:[\]]/g, " ").trim() || "Export").slice(0, 31);

export const buildXlsx = async <T>(dataset: ExportDataset<T>): Promise<Buffer> => {
  const workbook = new ExcelJS.Workbook();
  // No author, company, manager or custom properties: workbook metadata is a
  // known PHI leak when a file is forwarded outside the hospital.
  workbook.creator = "HMS";
  workbook.lastModifiedBy = "HMS";
  workbook.created = new Date();
  workbook.modified = new Date();

  const sheet = workbook.addWorksheet(safeSheetName(dataset.sheetName), {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  sheet.columns = dataset.columns.map((column) => ({
    header: column.header,
    key: column.key,
    width: column.width ?? Math.max(12, column.header.length + 4),
  }));

  const header = sheet.getRow(1);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E3A5F" } };
  header.alignment = { vertical: "middle" };
  header.height = 20;

  for (const row of dataset.rows) {
    const values: Record<string, CellValue> = {};
    for (const column of dataset.columns) values[column.key] = column.value(row);
    sheet.addRow(values);
  }

  for (const column of dataset.columns) {
    const target = sheet.getColumn(column.key);
    target.alignment = { vertical: "top", wrapText: false };
  }
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: Math.max(1, sheet.rowCount), column: dataset.columns.length },
  };

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
};

export const exportFileName = (name: string, extension: "csv" | "xlsx", date = new Date()): string =>
  `${name}-${date.toISOString().slice(0, 10)}.${extension}`;
