import React, { useEffect } from 'react';

export default function ConfirmModal({ isOpen, title, message, onConfirm, onCancel, confirmText = 'Confirmar', cancelText = 'Cancelar', isDanger = false }) {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onCancel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  return (
    <div
      className="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="modal-card" style={{ width: '420px' }}>
        <div className="modal-header">
          <h3 style={{ fontSize: '16px' }}>{title}</h3>
          <button
            className="btn-icon"
            onClick={onCancel}
            style={{ background: 'transparent', border: 'none', fontSize: '18px', color: '#64748b' }}
          >
            ✕
          </button>
        </div>
        <div className="modal-body">
          <p style={{ color: '#475569', fontSize: '14px', lineHeight: '1.5' }}>{message}</p>
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-clear" onClick={onCancel}>
            {cancelText}
          </button>
          <button
            type="button"
            className={`btn ${isDanger ? 'btn-danger' : 'btn-primary'}`}
            onClick={onConfirm}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
