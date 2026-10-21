// Shared by the browser and the Node server.
export const MAX_NAME = 24;
export const MAX_TEXT = 4000;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const CHUNK_BYTES = 128 * 1024;
export const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

// C0/C1 controls, zero-width and bidi override characters.
const UNSUPPORTED = /[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2066-\u2069\ufeff]/;

export const normalizeName = (s: string) => s.trim().toLowerCase();

export function validateName(raw: string): string | null {
  const v = raw.trim();
  if (!v) return 'Enter a name.';
  if (v.length > MAX_NAME) return `Keep it to ${MAX_NAME} characters or fewer.`;
  if (UNSUPPORTED.test(v)) return 'That name contains characters we can’t use.';
  return null;
}

export function validateImage(file: { type: string; size: number; name: string }): string | null {
  if (!ALLOWED_MIME.includes(file.type)) return `“${file.name}” can’t be sent. Use JPEG, PNG, WebP or GIF.`;
  if (file.size > MAX_IMAGE_BYTES) return `“${file.name}” is ${(file.size / 1048576).toFixed(1)} MB. The limit is 5 MB.`;
  if (file.size === 0) return `“${file.name}” is empty.`;
  return null;
}

export function errorText(code?: string): string {
  switch (code) {
    case 'rate': return 'Slow down a little and try again.';
    case 'timeout': return 'The connection timed out. Try again.';
    case 'mismatch': return 'That name doesn’t match this invitation. Check the spelling and try again.';
    case 'same-name': return 'Their name must be different from yours.';
    case 'invalid-name': return 'That name isn’t valid.';
    case 'image-type': return 'That file isn’t a supported image.';
    case 'image-size': return 'Images can be up to 5 MB.';
    case 'invalid-text': return `Messages can be up to ${MAX_TEXT} characters.`;
    case 'inactive': return 'The chat isn’t active right now.';
    case 'upload': return 'The image couldn’t be sent. Try again.';
    default: return 'Something went wrong. Try again.';
  }
}
