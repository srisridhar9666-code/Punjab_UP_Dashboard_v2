import { useTheme } from '@/hooks/useTheme'
import { cn } from '@/lib/cn'

export const COMPANY = 'DesignBoxed Innovations Pvt. Ltd'
export const CREATOR = 'Sridhar'

/** DesignBoxed logo: dark lettering on light surfaces, white lettering on dark ones. */
export function CompanyLogo({ className, dark }: { className?: string; dark?: boolean }) {
  const [, mode] = useTheme()
  const onDark = dark ?? mode === 'dark'
  return <img src={onDark ? '/brand/db_logo_white.png' : '/brand/db_logo_black.png'} alt={COMPANY} className={cn('w-auto shrink-0 object-contain', className)} />
}
