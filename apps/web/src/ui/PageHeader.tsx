import type { LucideIcon } from 'lucide-react'

interface PageHeaderProps {
  icon?: LucideIcon
  title: React.ReactNode
  description?: React.ReactNode
  /** Rendered inline next to the title, e.g. a company badge. */
  badge?: React.ReactNode
  /** Action buttons shown on the right. */
  children?: React.ReactNode
}

/** Standard page title block: icon, heading, description and right-aligned actions. */
export default function PageHeader({ icon: Icon, title, description, badge, children }: PageHeaderProps) {
  return (
    <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-gray-900">
          {Icon && <Icon size={22} className="text-blue-600" aria-hidden />}
          {title}
          {badge}
        </h1>
        {description && <p className="mt-1 text-sm text-gray-500">{description}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </header>
  )
}
