import React from 'react'

interface CardProps {
  children: React.ReactNode
  className?: string
}

export function Card({ children, className = '' }: CardProps) {
  return (
    <div className={`bg-zinc-900 border border-white/5 rounded-2xl p-5 ${className}`}>
      {children}
    </div>
  )
}

interface StatCardProps {
  title: string
  value: string
  icon?: React.ReactNode
  accent?: boolean
  subtitle?: string
  trend?: 'up' | 'down' | 'neutral'
  color?: 'purple' | 'amber' | 'green' | 'red' | 'blue'
}

const colorMap = {
  purple: { icon: 'bg-purple-500/10 text-purple-400', value: 'text-white' },
  amber: { icon: 'bg-amber-500/10 text-amber-400', value: 'text-amber-400' },
  green: { icon: 'bg-green-500/10 text-green-400', value: 'text-green-400' },
  red: { icon: 'bg-red-500/10 text-red-400', value: 'text-red-400' },
  blue: { icon: 'bg-blue-500/10 text-blue-400', value: 'text-blue-400' },
}

export function StatCard({ title, value, icon, accent = false, subtitle, color }: StatCardProps) {
  const resolvedColor = color ?? (accent ? 'amber' : 'purple')
  const colors = colorMap[resolvedColor]

  return (
    <div className="bg-zinc-900 border border-white/5 rounded-2xl p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className="text-zinc-400 text-xs font-medium uppercase tracking-wider">{title}</span>
        {icon && (
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${colors.icon}`}>
            {icon}
          </div>
        )}
      </div>
      <div>
        <p className={`text-2xl font-bold tracking-tight tabular-nums ${colors.value}`}>{value}</p>
        {subtitle && <p className="text-zinc-500 text-xs mt-1.5">{subtitle}</p>}
      </div>
    </div>
  )
}
