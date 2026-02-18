import React, { useRef, useState, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useAppContext } from '@/state/app-context';
import { Document } from '@/state/types';
import { fileToBase64, getMimeType, isAcceptedFileType } from '@/lib/file-utils';

interface FileDropZoneProps {
  side: 'invoice' | 'receipt';
  rowId: string;
  document: Document | null;
  className?: string;
}

export default function FileDropZone({
  side,
  rowId,
  document: doc,
  className = '',
}: FileDropZoneProps) {
  const { dispatch } = useAppContext();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleFile = useCallback(
    async (file: File) => {
      if (!isAcceptedFileType(file)) {
        alert('Nepodporovaný formát souboru. Povolené: PDF, JPG, PNG.');
        return;
      }

      const base64 = await fileToBase64(file);
      const mimeType = getMimeType(file);

      const newDoc: Document = {
        id: uuidv4(),
        type: side,
        name: file.name,
        filePath: file.name,
        mimeType,
        status: 'pending',
        items: [],
        rawData: base64,
      };

      dispatch({ type: 'SET_DOCUMENT', rowId, side, document: newDoc });
    },
    [dispatch, rowId, side]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      const file = e.dataTransfer.files[0];
      if (file) {
        handleFile(file);
      }
    },
    [handleFile]
  );

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFile(file);
    }
    // Reset input so the same file can be re-selected
    e.target.value = '';
  };

  return (
    <td className={`px-2 py-1 ${className}`}>
      <div
        className={`
          relative rounded-md border-2 border-dashed px-3 py-2 text-center text-sm
          cursor-pointer transition-colors min-w-[140px]
          ${isDragOver ? 'border-blue-500 bg-blue-50' : 'border-gray-300'}
          ${doc ? '' : 'hover:border-gray-400'}
        `}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
        title={doc ? doc.name : 'Klikněte nebo přetáhněte soubor'}
      >
        {doc ? (
          <span className="truncate block max-w-[160px]" title={doc.name}>
            {doc.name}
          </span>
        ) : (
          <span className="italic text-gray-500">{'< není vložen >'}</span>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png"
          className="hidden"
          onChange={handleInputChange}
        />
      </div>
    </td>
  );
}
