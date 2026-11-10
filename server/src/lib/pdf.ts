import PDFDocument from "pdfkit";
import { env } from "../config/env.js";

export interface PdfMeta {
  label: string;
  value: string;
}

export interface PdfTable {
  columns: Array<{ header: string; key: string; width: number; align?: "left" | "right" }>;
  rows: Array<Record<string, string | number | null | undefined>>;
}

const PAGE_MARGIN = 48;
const FOOTER_SPACE = 34;
const HEADER_BLUE = "#1e3a5f";

export const createPdf = (): PDFKit.PDFDocument =>
  new PDFDocument({
    size: "LETTER",
    margins: { top: PAGE_MARGIN, left: PAGE_MARGIN, right: PAGE_MARGIN, bottom: PAGE_MARGIN + FOOTER_SPACE },
    bufferPages: true,
    info: {
      Title: "Clinical document",
      Author: env.hospitalName,
      // No patient identifiers in document metadata: it travels with the file.
      Subject: "HMS document",
      Creator: "HMS",
    },
    // Tests inspect uncompressed strings; production keeps compression on.
    compress: !env.isTest,
  });

export const drawHeader = (doc: PDFKit.PDFDocument, title: string, subtitle?: string): void => {
  const width = doc.page.width - PAGE_MARGIN * 2;
  doc.fillColor(HEADER_BLUE).fontSize(18).font("Helvetica-Bold").text(env.hospitalName, PAGE_MARGIN, PAGE_MARGIN);
  doc.fillColor("#475569").fontSize(9).font("Helvetica").text("Hospital Management System", PAGE_MARGIN, PAGE_MARGIN + 24);
  doc.moveTo(PAGE_MARGIN, PAGE_MARGIN + 42).lineTo(PAGE_MARGIN + width, PAGE_MARGIN + 42).strokeColor("#cbd5e1").stroke();

  doc.fillColor("#0f172a").fontSize(16).font("Helvetica-Bold").text(title, PAGE_MARGIN, PAGE_MARGIN + 56);
  if (subtitle) {
    doc.fillColor("#475569").fontSize(10).font("Helvetica").text(subtitle, PAGE_MARGIN, doc.y + 2);
  }
  doc.moveDown(0.8);
};

export const drawMetaGrid = (doc: PDFKit.PDFDocument, meta: PdfMeta[]): void => {
  const width = doc.page.width - PAGE_MARGIN * 2;
  const columnWidth = width / 2;
  const startY = doc.y;
  meta.forEach((item, index) => {
    const column = index % 2;
    const row = Math.floor(index / 2);
    const x = PAGE_MARGIN + column * columnWidth;
    const y = startY + row * 30;
    doc.fillColor("#64748b").fontSize(8).font("Helvetica-Bold").text(item.label.toUpperCase(), x, y, {
      width: columnWidth - 12,
    });
    doc.fillColor("#0f172a").fontSize(10).font("Helvetica").text(item.value || "—", x, y + 11, {
      width: columnWidth - 12,
      ellipsis: true,
    });
  });
  doc.y = startY + Math.ceil(meta.length / 2) * 30 + 12;
};

export const drawSectionTitle = (doc: PDFKit.PDFDocument, title: string): void => {
  doc.moveDown(0.4);
  doc.fillColor(HEADER_BLUE).fontSize(11).font("Helvetica-Bold").text(title);
  doc.moveDown(0.3);
};

const ensureSpace = (doc: PDFKit.PDFDocument, needed: number): void => {
  if (doc.y + needed <= doc.page.height - PAGE_MARGIN - FOOTER_SPACE) return;
  doc.addPage();
  doc.y = PAGE_MARGIN;
};

export const drawTable = (doc: PDFKit.PDFDocument, table: PdfTable): void => {
  const rowHeight = 20;
  const startX = PAGE_MARGIN;
  const drawHeaderRow = (): void => {
    const y = doc.y;
    doc.rect(startX, y, table.columns.reduce((sum, c) => sum + c.width, 0), rowHeight).fill("#e2e8f0");
    let x = startX;
    doc.fillColor("#0f172a").fontSize(8).font("Helvetica-Bold");
    for (const column of table.columns) {
      doc.text(column.header, x + 4, y + 6, { width: column.width - 8, align: column.align ?? "left" });
      x += column.width;
    }
    doc.y = y + rowHeight;
  };

  ensureSpace(doc, rowHeight * 2);
  drawHeaderRow();

  for (const row of table.rows) {
    ensureSpace(doc, rowHeight);
    if (doc.y === PAGE_MARGIN) drawHeaderRow();
    const y = doc.y;
    let x = startX;
    doc.font("Helvetica").fontSize(8).fillColor("#0f172a");
    for (const column of table.columns) {
      const value = row[column.key];
      doc.text(value === null || value === undefined ? "" : String(value), x + 4, y + 6, {
        width: column.width - 8,
        height: rowHeight - 8,
        ellipsis: true,
        align: column.align ?? "left",
      });
      x += column.width;
    }
    doc.moveTo(startX, y + rowHeight).lineTo(startX + table.columns.reduce((s, c) => s + c.width, 0), y + rowHeight).strokeColor("#e2e8f0").stroke();
    doc.y = y + rowHeight;
  }
  doc.moveDown(0.6);
};

export const finalizePdf = async (doc: PDFKit.PDFDocument): Promise<Buffer> => {
  const pageRange = doc.bufferedPageRange();
  for (let i = 0; i < pageRange.count; i += 1) {
    doc.switchToPage(pageRange.start + i);
    doc.fillColor("#94a3b8").fontSize(7).font("Helvetica");
    doc.text(
      `Generated ${new Date().toISOString()} · Page ${i + 1} of ${pageRange.count} · Confidential`,
      PAGE_MARGIN,
      doc.page.height - PAGE_MARGIN - 12,
      { width: doc.page.width - PAGE_MARGIN * 2, align: "center", lineBreak: false },
    );
  }
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc.end();
  });
};
