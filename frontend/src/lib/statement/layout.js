// Rebuilds lines and table rows from positioned PDF text items ({ str, x, y, w, h, page }).
// PDF y grows upwards, so a page reads from the largest y down.
import { detectHeader } from './table.js';

/** Groups text items into lines by y position, then merges close items on a line into cells. */
export function groupLines(items) {
  const clean = items
    .filter((it) => it && typeof it.str === 'string' && it.str.trim())
    .map((it) => ({ ...it, w: Number(it.w) || it.str.length * (Number(it.h) || 10) * 0.5, h: Number(it.h) || 10, page: it.page || 1 }))
    .sort((a, b) => a.page - b.page || b.y - a.y || a.x - b.x);

  const lines = [];
  clean.forEach((it) => {
    const tol = Math.max(2, it.h * 0.45);
    const line = lines.length ? lines[lines.length - 1] : null;
    if (line && line.page === it.page && Math.abs(line.y - it.y) <= tol) line.items.push(it);
    else lines.push({ page: it.page, y: it.y, items: [it] });
  });

  return lines.map((l) => {
    const sorted = l.items.sort((a, b) => a.x - b.x);
    const cells = [];
    sorted.forEach((it) => {
      const prev = cells[cells.length - 1];
      const gap = prev ? it.x - prev.x2 : Infinity;
      if (prev && gap < Math.max(1.5, it.h * 0.4)) {
        prev.text += gap > it.h * 0.12 ? ` ${it.str.trim()}` : it.str.trim();
        prev.x2 = Math.max(prev.x2, it.x + it.w);
      } else cells.push({ text: it.str.trim(), x: it.x, x2: it.x + it.w });
    });
    return { page: l.page, y: l.y, cells, text: cells.map((c) => c.text).join('  ') };
  });
}

/**
 * Finds a header line and assigns every later cell to the header column it overlaps most.
 * Returns { rows, headerRow, mapping, confidence } in the same shape as a CSV table, or null.
 */
export function linesToTable(lines) {
  const plain = lines.map((l) => l.cells.map((c) => c.text));
  const found = detectHeader(plain);
  if (!found) return null;
  const header = lines[found.headerRow].cells;
  const centers = header.map((c) => (c.x + c.x2) / 2);
  const bands = centers.map((c, i) => [i === 0 ? -Infinity : (centers[i - 1] + c) / 2, i === centers.length - 1 ? Infinity : (c + centers[i + 1]) / 2]);

  const columnOf = (cell) => {
    let best = 0;
    let bestOverlap = -Infinity;
    bands.forEach(([a, b], i) => {
      const overlap = Math.min(cell.x2, b) - Math.max(cell.x, a);
      if (overlap > bestOverlap) {
        bestOverlap = overlap;
        best = i;
      }
    });
    return best;
  };

  const rows = lines.map((l, idx) => {
    if (idx <= found.headerRow) return plain[idx];
    const row = new Array(header.length).fill('');
    l.cells.forEach((cell) => {
      const i = columnOf(cell);
      row[i] = row[i] ? `${row[i]} ${cell.text}` : cell.text;
    });
    return row;
  });
  return { rows, headerRow: found.headerRow, mapping: found.mapping, confidence: found.confidence };
}
