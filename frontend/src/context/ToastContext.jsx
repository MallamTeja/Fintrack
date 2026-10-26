import { createContext, useCallback, useContext, useRef, useState } from 'react';
import Icon from '../components/Icon.jsx';
import './Toast.css';

const ToastContext = createContext(null);

// Toasts are reserved for failures and effects the user cannot already see.
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const seq = useRef(0);

  const dismiss = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const notify = useCallback(
    (message, { tone = 'error', action, timeout = 6000 } = {}) => {
      const id = ++seq.current;
      setToasts((t) => [...t.slice(-2), { id, message, tone, action }]);
      if (timeout) setTimeout(() => dismiss(id), timeout);
      return id;
    },
    [dismiss]
  );

  return (
    <ToastContext.Provider value={notify}>
      {children}
      <div className="toasts" role="status" aria-live="polite" aria-relevant="additions">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast--${t.tone}`}>
            <p className="toast__msg">{t.message}</p>
            {t.action && (
              <button
                type="button"
                className="link-btn toast__action"
                onClick={() => {
                  t.action.onClick();
                  dismiss(t.id);
                }}
              >
                {t.action.label}
              </button>
            )}
            <button type="button" className="icon-btn toast__close" onClick={() => dismiss(t.id)} aria-label="Dismiss">
              <Icon name="close" size={16} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
