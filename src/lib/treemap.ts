export interface TreemapItem {
  id: string;
  value: number;
  [key: string]: unknown;
}

export interface TreemapNode {
  x: number;
  y: number;
  w: number;
  h: number;
  item: TreemapItem;
}

function worst(row: TreemapItem[], total: number, w: number): number {
  const rowSum = row.reduce((s, d) => s + d.value, 0);
  if (rowSum === 0 || w === 0) return Infinity;
  const s2 = (rowSum * rowSum) / (w * w);
  let worstRatio = 0;
  for (const d of row) {
    const r2 = (d.value * d.value) / s2;
    worstRatio = Math.max(worstRatio, r2, 1 / r2);
  }
  return worstRatio;
}

function squarifyInner(
  data: TreemapItem[],
  x: number,
  y: number,
  w: number,
  h: number,
): TreemapNode[] {
  if (data.length === 0) return [];
  if (data.length === 1) {
    return [{ x, y, w, h, item: data[0] }];
  }

  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) {
    const each = data.map((d, i) => ({
      x, y: y + (i * h) / data.length, w, h: h / data.length, item: d,
    }));
    return each;
  }

  const shortSide = Math.min(w, h);
  const result: TreemapNode[] = [];
  let row: TreemapItem[] = [];
  let remaining = [...data];
  let cx = x, cy = y, cw = w, ch = h;

  while (remaining.length > 0) {
    const d = remaining[0];
    if (row.length === 0) {
      row.push(d);
      remaining = remaining.slice(1);
      continue;
    }

    const currentWorst = worst(row, total, shortSide);
    const newWorst = worst([...row, d], total, shortSide);

    if (newWorst <= currentWorst) {
      row.push(d);
      remaining = remaining.slice(1);
    } else {
      // Lay out the current row
      const rowSum = row.reduce((s, item) => s + item.value, 0);
      const rowFrac = total > 0 ? rowSum / total : 0;

      if (cw >= ch) {
        // Horizontal split — row takes left portion
        const rowW = cw * rowFrac;
        let offsetY = 0;
        for (const item of row) {
          const itemFrac = rowSum > 0 ? item.value / rowSum : 1 / row.length;
          const itemH = ch * itemFrac;
          result.push({ x: cx, y: cy + offsetY, w: rowW, h: itemH, item });
          offsetY += itemH;
        }
        cx += rowW;
        cw -= rowW;
      } else {
        // Vertical split — row takes top portion
        const rowH = ch * rowFrac;
        let offsetX = 0;
        for (const item of row) {
          const itemFrac = rowSum > 0 ? item.value / rowSum : 1 / row.length;
          const itemW = cw * itemFrac;
          result.push({ x: cx + offsetX, y: cy, w: itemW, h: rowH, item });
          offsetX += itemW;
        }
        cy += rowH;
        ch -= rowH;
      }

      row = [d];
      remaining = remaining.slice(1);
    }
  }

  // Lay out final row
  if (row.length > 0) {
    const rowSum = row.reduce((s, item) => s + item.value, 0);
    if (cw >= ch) {
      let offsetY = 0;
      for (const item of row) {
        const itemFrac = rowSum > 0 ? item.value / rowSum : 1 / row.length;
        const itemH = ch * itemFrac;
        result.push({ x: cx, y: cy + offsetY, w: cw, h: itemH, item });
        offsetY += itemH;
      }
    } else {
      let offsetX = 0;
      for (const item of row) {
        const itemFrac = rowSum > 0 ? item.value / rowSum : 1 / row.length;
        const itemW = cw * itemFrac;
        result.push({ x: cx + offsetX, y: cy, w: itemW, h: ch, item });
        offsetX += itemW;
      }
    }
  }

  return result;
}

export function squarify(data: TreemapItem[], width: number, height: number): TreemapNode[] {
  const sorted = [...data].sort((a, b) => b.value - a.value);
  return squarifyInner(sorted, 0, 0, width, height);
}
