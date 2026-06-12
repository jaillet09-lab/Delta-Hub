import { cn } from '@/lib/utils'
import { type ButtonHTMLAttributes, forwardRef } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center gap-2 font-semibold rounded-lg transition-all duration-150 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1e3a5f]/40 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100',
          variant === 'primary'   && 'bg-[#1e3a5f] hover:bg-[#162d4a] text-white shadow-[0_1px_2px_rgba(16,24,40,0.15)]',
          variant === 'secondary' && 'bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 shadow-[0_1px_2px_rgba(16,24,40,0.05)]',
          variant === 'danger'    && 'bg-red-50 hover:bg-red-100 text-red-600 border border-red-200',
          variant === 'ghost'     && 'text-gray-500 hover:text-gray-900 hover:bg-gray-100',
          size === 'sm' && 'px-3 py-1.5 text-xs',
          size === 'md' && 'px-4 py-2 text-sm',
          size === 'lg' && 'px-5 py-2.5 text-sm',
          className
        )}
        {...props}
      >
        {children}
      </button>
    )
  }
)

Button.displayName = 'Button'
export { Button }
