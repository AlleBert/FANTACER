import { LayoutDashboard, Building2, Vote, Upload, Settings, Image as ImageIcon, type LucideIcon } from 'lucide-react'

export interface AdminNavItem {
  href: string
  label: string
  icon: LucideIcon
}

export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  { href: '/admin/dashboard/panoramica', label: 'Panoramica', icon: LayoutDashboard },
  { href: '/admin/dashboard/sponsor', label: 'Sponsor', icon: ImageIcon },
  { href: '/admin/dashboard/aziende', label: 'Aziende', icon: Building2 },
  { href: '/admin/dashboard/voti', label: 'Voti', icon: Vote },
  { href: '/admin/dashboard/import', label: 'Import', icon: Upload },
  { href: '/admin/dashboard/impostazioni', label: 'Impostazioni', icon: Settings },
]

export function isPathActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(href + '/')
}