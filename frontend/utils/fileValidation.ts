const ACCEPTED_MIME_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

const ACCEPTED_EXTENSIONS = new Set(['.pdf', '.docx']);
const MAX_SIZE_BYTES = 10 * 1024 * 1024;

export function validateFile(
  file: File
): { valid: true } | { valid: false; error: string } {
  const ext = '.' + file.name.split('.').pop()?.toLowerCase();
  if (!ACCEPTED_MIME_TYPES.has(file.type) && !ACCEPTED_EXTENSIONS.has(ext)) {
    return { valid: false, error: 'Only PDF and DOCX files are accepted.' };
  }
  if (file.size > MAX_SIZE_BYTES) {
    return { valid: false, error: 'File size must not exceed 10 MB.' };
  }
  return { valid: true };
}
