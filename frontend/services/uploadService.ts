export interface UploadResult {
  file_id: string;
  filename: string;
  message: string;
  user_id?: string;
}

export function uploadResume(
  file: File,
  onProgress: (pct: number) => void
): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const form = new FormData();
    form.append('file', file);

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const result = JSON.parse(xhr.responseText) as UploadResult;
        // Persist guest_id so the login/register flow can claim these uploads.
        if (result.user_id?.startsWith('guest_') && typeof window !== 'undefined') {
          localStorage.setItem('guest_id', result.user_id);
        }
        resolve(result);
      } else {
        try {
          const body = JSON.parse(xhr.responseText);
          reject(new Error(body.detail ?? 'Upload failed'));
        } catch {
          reject(new Error('Upload failed'));
        }
      }
    });

    xhr.addEventListener('error', () =>
      reject(new Error('Network error. Please try again.'))
    );

    xhr.open('POST', '/api/upload-resume');

    // If authenticated, attribute the upload to the user's account via X-User-Id.
    // The upload endpoint is open so no JWT verification is required here.
    if (typeof window !== 'undefined') {
      const storedUser = localStorage.getItem('auth_user');
      if (storedUser) {
        try {
          const { id } = JSON.parse(storedUser) as { id: string };
          if (id) xhr.setRequestHeader('X-User-Id', id);
        } catch { /* ignore parse errors */ }
      }
    }

    xhr.send(form);
  });
}
