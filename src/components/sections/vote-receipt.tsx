import { useLocale } from '@/lib/LocaleContext'
import type { SelectedCompany } from '@/lib/VoteContext'
import { cn } from '@/lib/utils'

interface VoteReceiptProps {
  companies: SelectedCompany[]
  className?: string
}

export function VoteReceipt({ companies, className }: VoteReceiptProps) {
  const { t } = useLocale()
  if (companies.length === 0) return null

  return (
    <div className={cn('vote-receipt-responsive w-full max-w-sm mx-auto rounded-(--rounded-lg) border-[3px] border-ink bg-white p-(--space-lg) text-left shadow-[4px_4px_0_#000]', className)}>
      <div className="mb-(--space-md) border-b-2 border-dashed border-ink/30 pb-(--space-sm)">
        <h3 className="text-(length:--fs-label) font-black uppercase tracking-[0.02em] text-purple">
          {t('success.receiptTitle')}
        </h3>
      </div>
      <ul className="flex flex-col gap-(--space-sm)">
        {companies.map((item, index) => (
          <li key={index} className="flex items-center justify-between gap-(--space-sm)">
            <span className="truncate text-(length:--fs-body) font-bold text-ink" title={item.company.name}>{item.company.name}</span>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-ink bg-purple text-(length:--fs-label) font-black text-white shadow-[2px_2px_0_#000]">
              {item.pallet}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
