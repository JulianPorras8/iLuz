import React from 'react';

export default function Toast({ toast }) {
  if (!toast) return null;

  const getIcon = (type) => {
    switch (type) {
      case 'success':
        return '✅';
      case 'error':
        return '❌';
      case 'warning':
        return '⚠️';
      default:
        return 'ℹ️';
    }
  };

  return (
    <div className="toast" style={{ pointerEvents: 'none' }}>
      <span>{getIcon(toast.type)}</span>
      <span>{toast.message}</span>
    </div>
  );
}
