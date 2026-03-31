import React, { useState, useRef, useEffect } from 'react';

const SETTINGS_PASSWORD = 'admin123';

interface PasswordModalProps {
  onSuccess: () => void;
  onCancel: () => void;
}

export default function PasswordModal({ onSuccess, onCancel }: PasswordModalProps) {
  const [value, setValue] = useState('');
  const [error, setError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value === SETTINGS_PASSWORD) {
      onSuccess();
    } else {
      setError(true);
      setValue('');
      inputRef.current?.focus();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-sm p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-1">Nastavení</h2>
        <p className="text-sm text-gray-500 mb-5">Zadejte heslo pro přístup do nastavení.</p>

        <form onSubmit={handleSubmit}>
          <input
            ref={inputRef}
            type="password"
            value={value}
            onChange={(e) => { setValue(e.target.value); setError(false); }}
            placeholder="Heslo"
            autoComplete="new-password"
            className={`w-full px-3 py-2 border rounded text-sm focus:outline-none focus:ring-2 ${
              error
                ? 'border-red-400 focus:ring-red-300'
                : 'border-gray-300 focus:ring-blue-300'
            }`}
          />
          {error && (
            <p className="text-xs text-red-500 mt-1">Nesprávné heslo. Zkuste to znovu.</p>
          )}

          <div className="flex gap-3 mt-5 justify-end">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
            >
              Zrušit
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            >
              Vstoupit
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
