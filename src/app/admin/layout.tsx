import { AdminLayout } from '@/components/admin/admin-layout'

export const dynamic = 'force-dynamic'

export default function AdminLayoutWrapper({ children }: { children: React.ReactNode }) {
  return <AdminLayout>{children}</AdminLayout>
}