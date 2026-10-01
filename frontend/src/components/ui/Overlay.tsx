import * as D from '@radix-ui/react-dialog'
import * as T from '@radix-ui/react-tooltip'
import { X } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

export function Dialog({ open, onOpenChange, title, description, children, className }: { open: boolean; onOpenChange: (o: boolean) => void; title: string; description?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] animate-fade-in" />
        <D.Content className={cn('fixed left-1/2 top-[12vh] z-50 w-[calc(100vw-32px)] max-w-md -translate-x-1/2 rounded-2xl bg-surface p-6 shadow-pop animate-fade-in', className)}>
          <D.Title className="text-base font-semibold">{title}</D.Title>
          {description && <D.Description className="mt-1 text-[13px] text-ink-3">{description}</D.Description>}
          <div className="mt-5">{children}</div>
          <D.Close className="absolute right-4 top-4 rounded-md p-1 text-ink-3 hover:bg-sunken hover:text-ink" aria-label="Close">
            <X className="h-4 w-4" />
          </D.Close>
        </D.Content>
      </D.Portal>
    </D.Root>
  )
}

export function Tip({ content, children, side = 'top' }: { content: ReactNode; children: ReactNode; side?: 'top' | 'bottom' | 'left' | 'right' }) {
  return (
    <T.Root delayDuration={200}>
      <T.Trigger asChild>{children}</T.Trigger>
      <T.Portal>
        <T.Content side={side} sideOffset={6} className="z-50 max-w-xs rounded-lg bg-ink px-2.5 py-1.5 text-[12px] text-page shadow-pop animate-fade-in">
          {content}
        </T.Content>
      </T.Portal>
    </T.Root>
  )
}
