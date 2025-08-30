import * as React from 'react'
import { cn } from '@/lib/utils'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', ...props }, ref) => {
    return (
      <button
        className={cn(
          'inline-flex items-center justify-center rounded-lg font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed',
          {
            'bg-accent-orange hover:bg-orange-600 text-white shadow-lg hover:shadow-xl transform hover:scale-105 focus:ring-accent-orange': variant === 'primary',
            'bg-transparent border-2 border-accent-cyan text-accent-cyan hover:bg-accent-cyan hover:text-white focus:ring-accent-cyan': variant === 'secondary',
            'border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 focus:ring-gray-500': variant === 'outline',
            'hover:bg-gray-100 text-gray-700 focus:ring-gray-500': variant === 'ghost',
          },
          {
            'px-3 py-2 text-sm': size === 'sm',
            'px-6 py-3 text-base': size === 'md',
            'px-8 py-4 text-lg': size === 'lg',
          },
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = 'Button'

export { Button }