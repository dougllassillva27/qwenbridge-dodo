import * as React from 'react'
import { cn } from '@/lib/utils'

function Separator({ className, orientation = 'horizontal', ...props }: React.ComponentProps<'div'> & { orientation?: 'horizontal' | 'vertical' }) {
  const horz = orientation === 'horizontal'
  return (
    <div
      data-slot="separator"
      role={horz ? 'separator' : undefined}
      aria-orientation={horz ? 'horizontal' : 'vertical'}
      className={cn('bg-border shrink-0', horz ? 'h-px w-full' : 'h-full w-px', className)}
      {...props}
    />
  )
}

export { Separator }