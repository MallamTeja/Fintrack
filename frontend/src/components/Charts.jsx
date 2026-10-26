import { useEffect, useRef, useState } from 'react';
import Money from './Money.jsx';
import { formatCompact, formatMoney } from '../lib/format.js';
import './Charts.css';

/** Progress meter. tone follows the budget rule: ochre from 80 %, brick when over. */
export function Meter({ value, max, label, tone }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  const t = tone || (pct > 100 ? 'over' : pct >= 80 ? 'near' : 'ok');
  return (
    <div
      className={`meter meter--${t}`}
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(Math.min(pct, 100))}
      aria-valuetext={`${Math.round(pct)} percent`}
    >
      <svg viewBox="0 0 100 6" preserveAspectRatio="none" aria-hidden="true">
        <rect className="meter__track" x="0" y="0" width="100" height="6" rx="0" />
        <rect className="meter__fill" x="0" y="0" width={Math.min(pct, 100)} height="6" />
        <line className="meter__mark" x1="80" x2="80" y1="0" y2="6" vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  );
}

/** Horizontal bars, one row per category, scaled to the largest. */
export function CategoryBars({ rows, currency }) {
  const max = Math.max(...rows.map((r) => r.value), 1);
  const total = rows.reduce((s, r) => s + r.value, 0);
  return (
    <ol className="catbars">
      {rows.map((r) => {
        const share = total ? Math.round((r.value / total) * 100) : 0;
        return (
          <li key={r.label} className="catbars__row">
            <span className="catbars__label">{r.label}</span>
            <span className="catbars__value">
              <Money amount={r.value} size="sm" decimals={false} />
              <span className="catbars__share num">{share}%</span>
            </span>
            <svg
              className="catbars__bar"
              viewBox="0 0 100 4"
              preserveAspectRatio="none"
              role="img"
              aria-label={`${r.label}: ${formatMoney(r.value, currency)}, ${share} percent of spending`}
            >
              <rect x="0" y="0" width={(r.value / max) * 100} height="4" />
            </svg>
          </li>
        );
      })}
    </ol>
  );
}

function useWidth() {
  const ref = useRef(null);
  const [width, setWidth] = useState(640);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}

function niceMax(v) {
  if (v <= 0) return 1;
  const exp = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / exp;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
  return step * exp;
}

/** Paired monthly bars: income (green) beside spending (brick). Drawn at measured width so labels stay legible. */
export function TrendChart({ months, currency }) {
  const [ref, width] = useWidth();
  const height = 220;
  const pad = { top: 12, right: 8, bottom: 28, left: 52 };
  const innerW = Math.max(width - pad.left - pad.right, 120);
  const innerH = height - pad.top - pad.bottom;
  const max = niceMax(Math.max(...months.flatMap((m) => [m.income, m.expense]), 0));
  const ticks = [0, 0.5, 1].map((f) => f * max);
  const band = innerW / months.length;
  const barW = Math.max(Math.min(band * 0.26, 22), 4);
  const y = (v) => pad.top + innerH - (v / max) * innerH;

  return (
    <figure className="trend" ref={ref}>
      <svg
        width="100%"
        height={height}
        viewBox={`0 0 ${Math.max(width, 200)} ${height}`}
        role="img"
        aria-label="Income and spending for the last six months. Full figures in the table that follows."
      >
        {ticks.map((t) => (
          <g key={t}>
            <line className="trend__grid" x1={pad.left} x2={pad.left + innerW} y1={y(t)} y2={y(t)} />
            <text className="trend__tick" x={pad.left - 8} y={y(t)} dy="0.32em" textAnchor="end">
              {formatCompact(t, currency)}
            </text>
          </g>
        ))}
        {months.map((m, i) => {
          const cx = pad.left + band * i + band / 2;
          return (
            <g key={m.key}>
              <rect className="trend__in" x={cx - barW - 1} y={y(m.income)} width={barW} height={Math.max(y(0) - y(m.income), 0)} />
              <rect className="trend__out" x={cx + 1} y={y(m.expense)} width={barW} height={Math.max(y(0) - y(m.expense), 0)} />
              <text className={`trend__month${m.current ? ' is-current' : ''}`} x={cx} y={height - 8} textAnchor="middle">
                {m.label}
              </text>
            </g>
          );
        })}
        <line className="trend__base" x1={pad.left} x2={pad.left + innerW} y1={y(0)} y2={y(0)} />
      </svg>
      <figcaption className="trend__legend">
        <span className="trend__key trend__key--in">Income</span>
        <span className="trend__key trend__key--out">Spending</span>
      </figcaption>
      <table className="visually-hidden">
        <caption>Monthly income and spending</caption>
        <thead>
          <tr>
            <th scope="col">Month</th>
            <th scope="col">Income</th>
            <th scope="col">Spending</th>
          </tr>
        </thead>
        <tbody>
          {months.map((m) => (
            <tr key={m.key}>
              <th scope="row">{m.label}</th>
              <td>{formatMoney(m.income, currency)}</td>
              <td>{formatMoney(m.expense, currency)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
