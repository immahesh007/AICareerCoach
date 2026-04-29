export interface UploadResult {
  file_id: string;
  filename: string;
  message: string;
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
        resolve(JSON.parse(xhr.responseText) as UploadResult);
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
    xhr.send(form);
  });
}
