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

/**
 * Ranked horizontal bars, one row per category, scaled to the largest.
 * tone: 'out' (spending, brick) or 'in' (income, green). Rows may carry a precomputed share and an `other` flag.
 */
export function CategoryBars({ rows, currency, tone = 'out', noun = 'spending' }) {
  const max = Math.max(...rows.map((r) => r.value), 1);
  const total = rows.reduce((s, r) => s + r.value, 0);
  return (
    <ol className={`catbars catbars--${tone}`}>
      {rows.map((r) => {
        const raw = r.share ?? (total ? (r.value / total) * 100 : 0);
        const share = raw > 0 && raw < 0.5 ? '<1' : String(Math.round(raw));
        const label = r.other ? `Other (${r.count} ${r.count === 1 ? 'category' : 'categories'})` : r.label;
        return (
          <li key={r.label} className={`catbars__row${r.other ? ' is-other' : ''}`}>
            <span className="catbars__label">{label}</span>
            <span className="catbars__value">
              <Money amount={r.value} size="sm" decimals={false} />
              <span className="catbars__share num">{share}%</span>
            </span>
            <svg
              className="catbars__bar"
              viewBox="0 0 100 4"
              preserveAspectRatio="none"
              role="img"
              aria-label={`${label}: ${formatMoney(r.value, currency)}, ${share === '<1' ? 'less than 1' : share} percent of ${noun}`}
            >
              <rect className="catbars__track" x="0" y="0" width="100" height="4" />
              <rect className="catbars__fill" x="0" y="0" width={(r.value / max) * 100} height="4" />
            </svg>
          </li>
        );
      })}
    </ol>
  );
}

function useWidth(initial = 640) {
  const ref = useRef(null);
  const [width, setWidth] = useState(initial);
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

/**
 * Pointer and keyboard scrubbing across n slots. The chart wrapper is one tab stop;
 * arrow keys, Home and End move between slots, and the pointer picks the nearest slot.
 */
function useScrub(n, fallback) {
  const [active, setActive] = useState(null);
  const clamp = (i) => Math.max(0, Math.min(n - 1, i));
  const onKeyDown = (e) => {
    const cur = active ?? fallback;
    const next = { ArrowLeft: cur - 1, ArrowRight: cur + 1, Home: 0, End: n - 1 }[e.key];
    if (next === undefined) return;
    e.preventDefault();
    setActive(clamp(next));
  };
  return {
    active,
    setActive: (i) => setActive(i == null ? null : clamp(i)),
    wrapProps: {
      tabIndex: 0,
      onKeyDown,
      onFocus: () => setActive((a) => a ?? fallback),
      onBlur: () => setActive(null),
      onPointerLeave: (e) => {
        if (document.activeElement !== e.currentTarget) setActive(null);
      },
    },
  };
}

/** Tooltip box positioned over the chart at x, kept inside the figure. */
function Tip({ x, width, children }) {
  const w = 184;
  const left = Math.max(0, Math.min(x - w / 2, width - w));
  return (
    <div className="ctip" style={{ left, width: w }} aria-hidden="true">
      {children}
    </div>
  );
}

const exact = (v, currency) => formatMoney(v, currency);
const signedExact = (v, currency) => (v > 0 ? `+${formatMoney(v, currency)}` : formatMoney(v, currency));

/**
 * Twelve months of cash flow: income and spending bars side by side, net as a line on the same scale.
 * months: [{ key, label, year, income, expense, net, current }].
 */
export function CashFlowChart({ months, currency }) {
  const [ref, width] = useWidth();
  const n = months.length;
  const { active, setActive, wrapProps } = useScrub(n, n - 1);
  const height = width < 480 ? 220 : 280;
  const pad = { top: 16, right: 8, bottom: 30, left: width < 480 ? 44 : 56 };
  const innerW = Math.max(width - pad.left - pad.right, 120);
  const innerH = height - pad.top - pad.bottom;
  const hi = niceMax(Math.max(...months.flatMap((m) => [m.income, m.expense, m.net]), 0));
  const minNet = Math.min(...months.map((m) => m.net), 0);
  const lo = minNet < 0 ? -niceMax(-minNet) : 0;
  const span = hi - lo || 1;
  const y = (v) => pad.top + ((hi - v) / span) * innerH;
  const ticks = lo < 0 ? [lo, 0, hi] : [0, hi / 2, hi];
  const band = innerW / n;
  const barW = Math.max(Math.min(band * 0.3, 18), 3);
  const cx = (i) => pad.left + band * i + band / 2;
  const everyOther = band < 36;
  const linePts = months.map((m, i) => `${cx(i)},${y(m.net)}`).join(' ');
  const a = active != null ? months[active] : null;

  const pick = (e) => {
    const box = e.currentTarget.getBoundingClientRect();
    setActive(Math.floor((e.clientX - box.left - pad.left) / band));
  };

  return (
    <figure className="chart cashflow" ref={ref}>
      <div
        className="chart__frame"
        role="group"
        aria-label="Cash flow by month. Use the left and right arrow keys to read each month."
        {...wrapProps}
        onPointerMove={pick}
      >
        <svg width="100%" height={height} viewBox={`0 0 ${Math.max(width, 200)} ${height}`} aria-hidden="true">
          {a && <rect className="chart__hover" x={pad.left + band * active} y={pad.top} width={band} height={innerH} />}
          {ticks.map((t) => (
            <g key={t}>
              <line
                className={t === 0 ? 'chart__base' : 'chart__grid'}
                x1={pad.left}
                x2={pad.left + innerW}
                y1={y(t)}
                y2={y(t)}
              />
              <text className="chart__tick" x={pad.left - 8} y={y(t)} dy="0.32em" textAnchor="end">
                {formatCompact(t, currency)}
              </text>
            </g>
          ))}
          {months.map((m, i) => (
            <g key={m.key}>
              <rect
                className="chart__in"
                x={cx(i) - barW - 1}
                y={y(m.income)}
                width={barW}
                height={Math.max(y(0) - y(m.income), 0)}
              />
              <rect
                className="chart__out"
                x={cx(i) + 1}
                y={y(m.expense)}
                width={barW}
                height={Math.max(y(0) - y(m.expense), 0)}
              />
              {(!everyOther || (n - 1 - i) % 2 === 0) && (
                <text
                  className={`chart__xlabel${m.current ? ' is-current' : ''}`}
                  x={cx(i)}
                  y={height - 9}
                  textAnchor="middle"
                >
                  {m.label}
                </text>
              )}
            </g>
          ))}
          <polyline className="chart__net" points={linePts} />
          {months.map((m, i) => (
            <circle
              key={m.key}
              className={`chart__netdot${active === i ? ' is-active' : ''}`}
              cx={cx(i)}
              cy={y(m.net)}
              r={active === i ? 4.5 : 3}
            />
          ))}
        </svg>
        {a && (
          <Tip x={cx(active)} width={width}>
            <p className="ctip__title">
              {a.label} {a.year}
            </p>
            <dl className="ctip__rows">
              <dt className="ctip__key ctip__key--in">Income</dt>
              <dd>{exact(a.income, currency)}</dd>
              <dt className="ctip__key ctip__key--out">Spending</dt>
              <dd>{exact(a.expense, currency)}</dd>
              <dt className="ctip__key ctip__key--net">Net</dt>
              <dd>{signedExact(a.net, currency)}</dd>
            </dl>
          </Tip>
        )}
      </div>
      <p className="visually-hidden" aria-live="polite">
        {a
          ? `${a.label} ${a.year}: income ${exact(a.income, currency)}, spending ${exact(a.expense, currency)}, net ${signedExact(a.net, currency)}.`
          : ''}
      </p>
      <figcaption className="chart__legend">
        <span className="chart__key chart__key--in">Income</span>
        <span className="chart__key chart__key--out">Spending</span>
        <span className="chart__key chart__key--net">Net (income minus spending)</span>
      </figcaption>
      <div className="visually-hidden">
        <table>
          <caption>Income, spending and net by month</caption>
          <thead>
            <tr>
              <th scope="col">Month</th>
              <th scope="col">Income</th>
              <th scope="col">Spending</th>
              <th scope="col">Net</th>
            </tr>
          </thead>
          <tbody>
            {months.map((m) => (
              <tr key={m.key}>
                <th scope="row">
                  {m.label} {m.year}
                </th>
                <td>{exact(m.income, currency)}</td>
                <td>{exact(m.expense, currency)}</td>
                <td>{signedExact(m.net, currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}

/**
 * Running spending total by day of month: this month (solid, stops at today) against last month (dashed).
 * pace: output of analytics.cumulativePace.
 */
export function PaceChart({ pace, currency }) {
  const [ref, width] = useWidth(480);
  const { days, today, currentLabel, previousLabel } = pace;
  const n = days.length;
  const { active, setActive, wrapProps } = useScrub(n, today - 1);
  const height = 220;
  const pad = { top: 14, right: 12, bottom: 30, left: width < 480 ? 44 : 56 };
  const innerW = Math.max(width - pad.left - pad.right, 120);
  const innerH = height - pad.top - pad.bottom;
  const hi = niceMax(Math.max(...days.map((d) => Math.max(d.current ?? 0, d.previous ?? 0)), 0));
  const x = (day) => pad.left + ((day - 1) / Math.max(n - 1, 1)) * innerW;
  const y = (v) => pad.top + innerH - (v / hi) * innerH;
  const path = (key) =>
    days
      .filter((d) => d[key] != null)
      .map((d, i) => `${i ? 'L' : 'M'}${x(d.day).toFixed(1)},${y(d[key]).toFixed(1)}`)
      .join('');
  const xTicks = [1, 8, 15, 22, 29].filter((d) => d <= n);
  const d = active != null ? days[active] : null;
  const last = days[today - 1];

  const pick = (e) => {
    const box = e.currentTarget.getBoundingClientRect();
    setActive(Math.round(((e.clientX - box.left - pad.left) / innerW) * (n - 1)));
  };

  return (
    <figure className="chart pace" ref={ref}>
      <div
        className="chart__frame"
        role="group"
        aria-label={`Cumulative spending by day, ${currentLabel} against ${previousLabel}. Use the left and right arrow keys to read each day.`}
        {...wrapProps}
        onPointerMove={pick}
      >
        <svg width="100%" height={height} viewBox={`0 0 ${Math.max(width, 200)} ${height}`} aria-hidden="true">
          {[0, hi / 2, hi].map((t) => (
            <g key={t}>
              <line
                className={t === 0 ? 'chart__base' : 'chart__grid'}
                x1={pad.left}
                x2={pad.left + innerW}
                y1={y(t)}
                y2={y(t)}
              />
              <text className="chart__tick" x={pad.left - 8} y={y(t)} dy="0.32em" textAnchor="end">
                {formatCompact(t, currency)}
              </text>
            </g>
          ))}
          {xTicks.map((t) => (
            <text key={t} className="chart__xlabel" x={x(t)} y={height - 9} textAnchor="middle">
              {t}
            </text>
          ))}
          {d && <line className="chart__cursor" x1={x(d.day)} x2={x(d.day)} y1={pad.top} y2={pad.top + innerH} />}
          <path className="pace__prev" d={path('previous')} />
          <path className="pace__cur" d={path('current')} />
          {last && last.current != null && <circle className="pace__dot" cx={x(today)} cy={y(last.current)} r="4" />}
          {d && d.previous != null && (
            <circle className="pace__dot pace__dot--prev" cx={x(d.day)} cy={y(d.previous)} r="3.5" />
          )}
          {d && d.current != null && <circle className="pace__dot" cx={x(d.day)} cy={y(d.current)} r="4" />}
        </svg>
        {d && (
          <Tip x={x(d.day)} width={width}>
            <p className="ctip__title">By day {d.day}</p>
            <dl className="ctip__rows">
              <dt className="ctip__key ctip__key--out">{currentLabel}</dt>
              <dd>{d.current != null ? exact(d.current, currency) : 'Not yet'}</dd>
              <dt className="ctip__key ctip__key--prev">{previousLabel}</dt>
              <dd>{d.previous != null ? exact(d.previous, currency) : 'No such day'}</dd>
            </dl>
          </Tip>
        )}
      </div>
      <p className="visually-hidden" aria-live="polite">
        {d
          ? `By day ${d.day}: ${currentLabel} ${d.current != null ? exact(d.current, currency) : 'not reached yet'}, ${previousLabel} ${
              d.previous != null ? exact(d.previous, currency) : 'no such day'
            }.`
          : ''}
      </p>
      <figcaption className="chart__legend">
        <span className="chart__key chart__key--out">{currentLabel}, to date</span>
        <span className="chart__key chart__key--prev">{previousLabel}, whole month</span>
        <span className="chart__axisnote">Day of month</span>
      </figcaption>
    </figure>
  );
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/**
 * Calendar heatmap of daily spending: columns are weeks (oldest left), rows are weekdays.
 * heat: output of analytics.dailyHeatmap. Shades are quartiles of the days that had spending.
 */
export function SpendHeatmap({ heat, currency }) {
  const { cells, weeks, cuts } = heat;
  const columns = Array.from({ length: weeks }, (_, w) => cells.filter((c) => c.week === w));
  const monthLabel = (col, w) => {
    const first = col.find((c) => c.date.endsWith('-01'));
    if (first) return first.label.split(' ')[1];
    const nextHasFirst = columns[1]?.some((x) => x.date.endsWith('-01'));
    return w === 0 && !nextHasFirst ? col[0].label.split(' ')[1] : '';
  };
  const c = (v) => formatCompact(v, currency);
  const legend = [
    { level: 0, text: 'None' },
    { level: 1, text: `Up to ${c(cuts[0])}` },
    { level: 2, text: `${c(cuts[0])} to ${c(cuts[1])}` },
    { level: 3, text: `${c(cuts[1])} to ${c(cuts[2])}` },
    { level: 4, text: `Over ${c(cuts[2])}` },
  ];
  const spent = cells.filter((x) => x.value > 0);

  return (
    <figure className="heat">
      <div className="heat__grid" style={{ '--weeks': weeks }} aria-hidden="true">
        <span />
        {columns.map((col, w) => (
          <span key={`m${col[0].date}`} className="heat__month">
            {monthLabel(col, w)}
          </span>
        ))}
        {WEEKDAYS.map((wd, r) => (
          <div key={wd} className="heat__row">
            <span className="heat__wd">{r % 2 === 0 ? wd : ''}</span>
            {columns.map((col) => {
              const cell = col[r];
              const title =
                cell.value == null
                  ? `${cell.label}: still to come`
                  : `${cell.label}: ${formatMoney(cell.value, currency)}`;
              return <span key={cell.date} className={`heat__cell heat--${cell.level ?? 'future'}`} title={title} />;
            })}
          </div>
        ))}
      </div>
      <figcaption>
        <ul className="heat__legend">
          {legend.map((l) => (
            <li key={l.level}>
              <span className={`heat__cell heat--${l.level}`} aria-hidden="true" />
              {l.text}
            </li>
          ))}
        </ul>
      </figcaption>
      <div className="visually-hidden">
        <table>
          <caption>Days with spending in the last {weeks} weeks</caption>
          <thead>
            <tr>
              <th scope="col">Day</th>
              <th scope="col">Spent</th>
            </tr>
          </thead>
          <tbody>
            {spent.map((x) => (
              <tr key={x.date}>
                <th scope="row">{x.label}</th>
                <td>{formatMoney(x.value, currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}
