import { Link } from 'react-router-dom';
import Modal from '../components/Modal.jsx';
import './shared.css';

export function ErrorNote({ error, onRetry }) {
  if (!error) return null;
  return (
    <div className="errnote" role="alert">
      <p>{error.message || 'Could not load this section.'}</p>
      {onRetry && (
        <button type="button" className="link-btn" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}

export function ConfirmDelete({ open, title, body, busy, onCancel, onConfirm, confirmLabel = 'Delete' }) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      variant="dialog"
      footer={
        <>
          <button type="button" className="btn" onClick={onCancel} data-autofocus>
            Keep it
          </button>
          <button type="button" className="btn btn--danger" onClick={onConfirm} disabled={busy}>
            {busy ? 'Deleting…' : confirmLabel}
          </button>
        </>
      }
    >
      <p className="muted">{body}</p>
    </Modal>
  );
}

export function NotFound() {
  return (
    <main className="notfound">
      <p className="notfound__code num" aria-hidden="true">
        404
      </p>
      <h1 className="notfound__title">This page is not in the ledger.</h1>
      <p className="muted">The address may be mistyped, or the page has moved.</p>
      <Link to="/" className="btn btn--primary">
        Back to overview
      </Link>
    </main>
  );
}

export function FieldError({ id, children }) {
  return (
    <p id={id} className="field__error">
      {children}
    </p>
  );
}
