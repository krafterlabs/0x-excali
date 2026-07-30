const EXTERNAL_URL_PATTERN = /^https?:\/\//i;

export function isExternalURL(url: string): boolean {
  return EXTERNAL_URL_PATTERN.test(url);
}

export async function openExternalURL(url: string): Promise<void> {
  if (!isExternalURL(url)) return;

  try {
    const { OpenExternalURL } = await import('../../wailsjs/go/main/App');
    OpenExternalURL(url);
  } catch {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}
