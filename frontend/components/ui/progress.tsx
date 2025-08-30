import * as React from 'react'
import { cn } from '@/lib/utils'

interface ProgressProps {
  value: number
  className?: string
  size?: 'sm' | 'md' | 'lg'
  variant?: 'default' | 'success' | 'warning' | 'danger'
}

export function Progress({ value, className, size = 'md', variant = 'default' }: ProgressProps) {
  const percentage = Math.min(Math.max(value, 0), 100)
  
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-full bg-gray-200',
        {
          'h-2': size === 'sm',
          'h-3': size === 'md',
          'h-4': size === 'lg',
        },
        className
      )}
    >
      <div
        className={cn(
          'h-full transition-all duration-300 ease-in-out',
          {
            'bg-accent-cyan': variant === 'default',
            'bg-green-500': variant === 'success',
            'bg-yellow-500': variant === 'warning',
            'bg-red-500': variant === 'danger',
          }
        )}
        style={{ width: `${percentage}%` }}
      />
    </div>
  )
}

interface CircularProgressProps {
  value: number
  size?: number
  strokeWidth?: number
  className?: string
  variant?: 'default' | 'success' | 'warning' | 'danger'
}

export function CircularProgress({ 
  value, 
  size = 60, 
  strokeWidth = 4, 
  className,
  variant = 'default' 
}: CircularProgressProps) {
  const percentage = Math.min(Math.max(value, 0), 100)
  const radius = (size - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const strokeDasharray = circumference
  const strokeDashoffset = circumference - (percentage / 100) * circumference
  
  const colorMap = {
    default: '#06b6d4',
    success: '#10b981',
    warning: '#f59e0b',
    danger: '#ef4444',
  }
  
  return (
    <div className={cn('relative inline-flex items-center justify-center', className)}>
      <svg
        width={size}
        height={size}
        className="transform -rotate-90"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#e5e7eb"
          strokeWidth={strokeWidth}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={colorMap[variant]}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={strokeDasharray}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className="transition-all duration-300 ease-in-out"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-xs font-semibold text-gray-700">
          {Math.round(percentage)}%
        </span>
      </div>
    </div>
  )
}