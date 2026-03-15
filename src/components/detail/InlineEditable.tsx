import React, { useState, useRef, useEffect } from 'react';

export default function InlineEditable({
  value,
  displayValue,
  onSave,
  className = '',
}: {
  value: string;
  displayValue?: string;
  onSave: (value: string) => void;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const startEdit = () => {
    setEditValue(value);
    setEditing(true);
  };

  const commitEdit = () => {
    setEditing(false);
    if (editValue !== value) {
      onSave(editValue);
    }
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={commitEdit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commitEdit();
          if (e.key === 'Escape') setEditing(false);
        }}
        className="w-full px-1 py-0 text-xs border border-blue-400 rounded focus:outline-none"
      />
    );
  }

  return (
    <span
      onDoubleClick={startEdit}
      className={`cursor-pointer hover:bg-yellow-50 rounded px-0.5 truncate inline-block ${className}`}
      title="Dvakrát klikněte pro úpravu"
    >
      {displayValue || value || '–'}
    </span>
  );
}
