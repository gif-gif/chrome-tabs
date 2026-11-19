const CHROME_WEB_STORE_DETAIL_URL = 'https://chromewebstore.google.com/detail/'

// Once published, the extension ID is also the Chrome Web Store item ID.
// Swap this for a fixed URL if the listing ever needs a different address.
export function getStorePageUrl(
  extensionId: string | undefined = globalThis.chrome?.runtime?.id,
): string | null {
  return extensionId ? `${CHROME_WEB_STORE_DETAIL_URL}${extensionId}` : null
}

export async function openStorePage(
  url: string,
  chromeApi: typeof chrome | undefined = globalThis.chrome,
): Promise<void> {
  if (typeof chromeApi?.tabs?.create === 'function') {
    await chromeApi.tabs.create({ url })
  } else {
    globalThis.open?.(url, '_blank', 'noopener')
  }
  globalThis.close?.()
}
