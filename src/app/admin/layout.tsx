import type { Metadata } from 'next'
import { AdminLayout } from '@/components/admin/admin-layout'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'FANTACER — Admin',
  robots: { index: false, follow: false },
}

export default function AdminLayoutWrapper({ children }: { children: React.ReactNode }) {
  return <AdminLayout>{children}</AdminLayout>
}