/**
 * Centralized data export engine — structured CSV, JSON, and XLSX downloads
 * for any table-shaped dataset.
 *
 * XLSX is emitted with a dependency-free writer: a STORED (uncompressed) ZIP
 * containing the minimal OOXML parts Excel/Numbers/Sheets accept.
 */

export interface ExportColumn {
  key: string;
  header: string;
  /** Optional value formatter; default String(v ?? ''). */
  format?: (v: unknown) => string;
}

export interface ExportRequest {
  /** Panel/scope name used in the filename, e.g. "watchlist", "fa-income". */
  scope: string;
  columns: ExportColumn[];
  rows: Array<Record<string, unknown>>;
  format: 'csv' | 'json' | 'xlsx';
  sheetName?: string;
}

// ---------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------

function csvEscape(v: string): string {
  if (/[",\n\r]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

export function toCsv(columns: ExportColumn[], rows: Array<Record<string, unknown>>): string {
  const cell = (c: ExportColumn, row: Record<string, unknown>): string => {
    const raw = c.format ? c.format(row[c.key]) : row[c.key];
    // Non-finite numbers degrade to empty cells — NaN/Infinity never export.
    if (typeof raw === 'number' && !Number.isFinite(raw)) return '';
    return csvEscape(String(raw ?? ''));
  };
  const head = columns.map((c) => csvEscape(c.header)).join(',');
  const body = rows.map((row) => columns.map((c) => cell(c, row)).join(','));
  return [head, ...body].join('\r\n');
}

// ---------------------------------------------------------------------------
// XLSX (minimal OOXML in a STORED zip)
// ---------------------------------------------------------------------------

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function zipStore(files: Array<{ name: string; data: string }>): Uint8Array {
  const enc = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;

  for (const file of files) {
    const nameBytes = enc.encode(file.name);
    const dataBytes = enc.encode(file.data);
    const crc = crc32(dataBytes);

    const local = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);          // version needed
    lv.setUint16(6, 0, true);           // flags
    lv.setUint16(8, 0, true);           // method: STORED
    lv.setUint16(10, 0, true);          // time
    lv.setUint16(12, 0x2100, true);     // date (2000-01-01ish, deterministic)
    lv.setUint32(14, crc, true);
    lv.setUint32(18, dataBytes.length, true);
    lv.setUint32(22, dataBytes.length, true);
    lv.setUint16(26, nameBytes.length, true);
    lv.setUint16(28, 0, true);
    local.set(nameBytes, 30);

    chunks.push(local, dataBytes);

    const cd = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(cd.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, 0, true);
    cv.setUint16(14, 0x2100, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, dataBytes.length, true);
    cv.setUint32(24, dataBytes.length, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint16(30, 0, true);   // extra
    cv.setUint16(32, 0, true);   // comment
    cv.setUint16(34, 0, true);   // disk
    cv.setUint16(36, 0, true);   // internal attrs
    cv.setUint32(38, 0, true);   // external attrs
    cv.setUint32(42, offset, true);
    cd.set(nameBytes, 46);
    central.push(cd);

    offset += local.length + dataBytes.length;
  }

  const centralSize = central.reduce((s, c) => s + c.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, files.length, true);
  ev.setUint16(10, files.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);

  const total = [...chunks, ...central, end];
  const out = new Uint8Array(total.reduce((s, c) => s + c.length, 0));
  let pos = 0;
  for (const part of total) { out.set(part, pos); pos += part.length; }
  return out;
}

function xmlEscape(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function colLetter(i: number): string {
  let s = '';
  let n = i;
  while (n >= 0) { s = String.fromCharCode((n % 26) + 65) + s; n = Math.floor(n / 26) - 1; }
  return s;
}

function cellRef(row: number, col: number): string {
  return `${colLetter(col)}${row + 1}`;
}

export function toXlsxBytes(columns: ExportColumn[], rows: Array<Record<string, unknown>>, sheetName = 'Data'): Uint8Array {
  const headers = columns.map((c) => c.header);
  const bodyRows = rows.map((row) => columns.map((c) => {
    const raw = c.format ? c.format(row[c.key]) : row[c.key];
    if (typeof raw === 'number' && Number.isFinite(raw)) return { t: 'n', v: raw };
    return { t: 's', v: String(raw ?? '') };
  }));

  let sheetXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>`;

  // Header row
  sheetXml += `<row r="1">` + headers.map((h, c) => `<c r="${cellRef(0, c)}" t="inlineStr"><is><t>${xmlEscape(h)}</t></is></c>`).join('') + `</row>`;
  // Body rows
  bodyRows.forEach((cells, r) => {
    sheetXml += `<row r="${r + 2}">` + cells.map((cell, c) =>
      cell.t === 'n'
        ? `<c r="${cellRef(r + 1, c)}"><v>${cell.v}</v></c>`
        : `<c r="${cellRef(r + 1, c)}" t="inlineStr"><is><t>${xmlEscape(String(cell.v))}</t></is></c>`,
    ).join('') + `</row>`;
  });
  sheetXml += `</sheetData></worksheet>`;

  const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets><sheet name="${xmlEscape(sheetName.slice(0, 28))}" sheetId="1" r:id="rId1"/></sheets></workbook>`;

  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

  const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts>
<fills count="1"><fill><patternFill patternType="none"/></fill></fills>
<borders count="1"><border/></borders>
<cellStyleXfs count="1"><xf/></cellStyleXfs>
<cellXfs count="1"><xf xfId="0"/></cellXfs>
</styleSheet>`;

  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`;

  return zipStore([
    { name: '[Content_Types].xml', data: contentTypes },
    { name: '_rels/.rels', data: rootRels },
    { name: 'xl/workbook.xml', data: workbook },
    { name: 'xl/_rels/workbook.xml.rels', data: rels },
    { name: 'xl/styles.xml', data: styles },
    { name: 'xl/worksheets/sheet1.xml', data: sheetXml },
  ]);
}

// ---------------------------------------------------------------------------
// Download dispatcher
// ---------------------------------------------------------------------------

export function exportData(request: ExportRequest): void {
  const stamp = new Date().toISOString().slice(0, 10);
  const base = `qube_${request.scope}_${stamp}`;

  if (request.format === 'csv') {
    const csv = toCsv(request.columns, request.rows);
    triggerDownload(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `${base}.csv`);
    return;
  }
  if (request.format === 'json') {
    const json = JSON.stringify({ scope: request.scope, exportedAt: new Date().toISOString(), columns: request.columns.map((c) => c.header), rows: request.rows }, null, 2);
    triggerDownload(new Blob([json], { type: 'application/json' }), `${base}.json`);
    return;
  }
  // xlsx
  const bytes = toXlsxBytes(request.columns, request.rows, request.sheetName ?? request.scope);
  triggerDownload(new Blob([bytes as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `${base}.xlsx`);
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/** Standard export columns for watchlist-shaped rows. */
export function watchlistExportColumns(): ExportColumn[] {
  return [
    { key: 'symbol', header: 'Symbol' },
    { key: 'price', header: 'Last' },
    { key: 'change', header: 'Change' },
    { key: 'changePercent', header: 'Change %' },
    { key: 'high52w', header: '52W High' },
    { key: 'low52w', header: '52W Low' },
  ];
}
