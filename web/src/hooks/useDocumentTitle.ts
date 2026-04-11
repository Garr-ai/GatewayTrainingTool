import { useEffect } from 'react'

/**
 * Sets the document title for the current page.
 * Automatically appends " — Gateway Training" as a suffix.
 * Restores the default title on unmount.
 */
export function useDocumentTitle(title: string) {
  useEffect(() => {
    const prev = document.title
    document.title = title ? `${title} — Gateway Training` : 'Gateway Training Tool'
    return () => { document.title = prev }
  }, [title])
}
