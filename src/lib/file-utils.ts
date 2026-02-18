export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Remove the data URL prefix (data:mime;base64,) to store raw base64
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

export function base64ToDataUrl(base64: string, mimeType: string): string {
  return `data:${mimeType};base64,${base64}`;
}

export function getMimeType(file: File): string {
  return file.type || 'application/octet-stream';
}

export function isAcceptedFileType(file: File): boolean {
  const accepted = [
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/jpg',
  ];
  return accepted.includes(file.type);
}
