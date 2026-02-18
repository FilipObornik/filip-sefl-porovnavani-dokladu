import { useState, useRef, useEffect } from 'react';

interface EditableCellProps {
  value: string | number | null;
  onChange: (value: string) => void;
  type?: 'text' | 'number';
  className?: string;
}

export default function EditableCell({ value, onChange, type = 'text', className = '' }: EditableCellProps) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const handleDoubleClick = () => {
    setEditValue(value === null || value === undefined ? '' : String(value));
    setEditing(true);
  };

  const handleBlur = () => {
    setEditing(false);
    onChange(editValue);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      setEditing(false);
      onChange(editValue);
    }
    if (e.key === 'Escape') {
      setEditing(false);
    }
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        type={type}
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className={`w-full px-1 py-0.5 text-xs border border-blue-400 rounded focus:outline-none ${className}`}
      />
    );
  }

  return (
    <span
      onDoubleClick={handleDoubleClick}
      className={`cursor-pointer hover:bg-blue-50 rounded px-1 py-0.5 inline-block min-w-[2rem] ${className}`}
      title="Dvakrát klikněte pro úpravu"
    >
      {value === null || value === undefined || value === '' ? '–' : String(value)}
    </span>
  );
}
