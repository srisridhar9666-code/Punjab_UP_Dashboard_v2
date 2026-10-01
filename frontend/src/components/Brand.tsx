import { useEffect, useState } from 'react'
import { cn } from '@/lib/cn'

export const COMPANY = 'DesignBoxed Innovations Pvt. Ltd'
export const CREATOR = 'Sridhar'

/** Company logo from public/brand (logo.svg, then logo.png); a "DB" monogram until the file is added. */
const SOURCES = ['/brand/logo.svg', '/brand/logo.png']

let found: Promise<string | null> | null = null
function findLogo(): Promise<string | null> {
  // The SPA answers unknown paths with index.html, so check the content type instead of relying on img errors.
  found ??= (async () => {
    for (const src of SOURCES) {
      try {
        const r = await fetch(src, { method: 'GET', cache: 'force-cache' })
        if (r.ok && (r.headers.get('content-type') ?? '').startsWith('image/')) return src
      } catch {
        /* try the next one */
      }
    }
    return null
  })()
  return found
}

export function CompanyLogo({ className, dark = false }: { className?: string; dark?: boolean }) {
  const [src, setSrc] = useState<string | null>(null)
  useEffect(() => {
    let live = true
    findLogo().then((s) => live && setSrc(s))
    return () => {
      live = false
    }
  }, [])
  if (src) return <img src={src} alt={COMPANY} className={cn('shrink-0 rounded-[9px] object-contain', className)} />
  return (
    <span
      aria-label={COMPANY}
      className={cn(
        'grid shrink-0 place-items-center rounded-[9px] text-[13px] font-bold tracking-[-0.04em] shadow-sm',
        dark ? 'bg-white/10 text-white ring-1 ring-white/15' : 'bg-gradient-to-br from-[#2a78d6] to-[#4a3aa7] text-white',
        className,
      )}
    >
      DB
    </span>
  )
}
