import { formatMoney, moneyParts } from '../lib/format.js';
import { useAuth } from '../context/AuthContext.jsx';
import './Money.css';

/**
 * Renders an amount with the figure as the hero and the symbol and decimals set quieter.
 * type: 'income' | 'expense' colours and signs the amount. size: 'sm' | 'md' | 'lg' | 'hero'.
 */
export default function Money({ amount, type, size = 'md', decimals = true, signed = false, className = '' }) {
  const { currency } = useAuth();
  const value = Number(amount) || 0;
  const p = moneyParts(value, currency, { decimals });
  let sign = p.sign;
  if (signed && type === 'expense') sign = '−';
  if (signed && type === 'income') sign = '+';
  const tone = type === 'income' ? 'is-in' : type === 'expense' ? 'is-out' : '';
  const label = `${sign === '−' ? 'minus ' : sign === '+' ? 'plus ' : ''}${formatMoney(Math.abs(value), currency)}`;

  return (
    <span className={`money money--${size} num ${tone} ${className}`} aria-label={label}>
      <span aria-hidden="true">
        {sign && <span className="money__sign">{sign}</span>}
        {p.symbolFirst && <span className="money__sym">{p.symbol}</span>}
        <span className="money__whole">{p.whole}</span>
        {p.fraction && <span className="money__frac">{p.fraction}</span>}
        {!p.symbolFirst && <span className="money__sym money__sym--after">{p.symbol}</span>}
      </span>
    </span>
  );
}
