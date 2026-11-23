// Fixed listing address, so unpacked dev builds (which get a different runtime ID) still open the published page.
export const STORE_PAGE_URL = 'https://chromewebstore.google.com/detail/tab-manager/jnlddbkjimakfiglopimemjlabocnhag'

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
