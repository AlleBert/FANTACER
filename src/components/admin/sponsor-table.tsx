'use client';

interface Sponsor {
  id: string;
  name: string;
  image_url: string | null;
  website_url: string | null;
  is_active: boolean;
  sort_order: number;
}

interface SponsorTableProps {
  sponsors: Sponsor[];
  onEdit: (sponsor: Sponsor) => void;
  onDelete: (id: string) => void;
  onToggleActive: (sponsor: Sponsor) => void;
  readOnly?: boolean;
}

export function SponsorTable({ sponsors, onEdit, onDelete, onToggleActive, readOnly }: SponsorTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b-2 border-black/10 text-left">
            <th className="p-3 font-black">Ordine</th>
            <th className="p-3 font-black">Nome</th>
            <th className="p-3 font-black">Logo</th>
            <th className="p-3 font-black">Link</th>
            <th className="p-3 font-black">Attivo</th>
            {!readOnly && <th className="p-3 font-black">Azioni</th>}
          </tr>
        </thead>
        <tbody>
          {sponsors.map((sponsor) => (
            <tr key={sponsor.id} className="border-b border-black/5 hover:bg-gray-50">
              <td className="p-3">{sponsor.sort_order}</td>
              <td className="p-3 font-bold">{sponsor.name}</td>
              <td className="p-3">
                {sponsor.image_url ? (
                  <img src={sponsor.image_url} alt={sponsor.name} className="w-10 h-10 object-contain rounded border border-black/10" />
                ) : (
                  <span className="text-gray-400">—</span>
                )}
              </td>
              <td className="p-3 max-w-[200px] truncate">
                {sponsor.website_url ? (
                  <a href={sponsor.website_url} target="_blank" rel="noopener noreferrer" className="text-purple hover:underline">
                    {sponsor.website_url}
                  </a>
                ) : (
                  <span className="text-gray-400">—</span>
                )}
              </td>
              <td className="p-3">
                {readOnly ? (
                  <span className={`px-3 py-2.5 rounded-full text-xs font-bold text-black ${
                    sponsor.is_active ? 'bg-green-400' : 'bg-gray-200 text-gray-500'
                  }`}>
                    {sponsor.is_active ? 'SÌ' : 'NO'}
                  </span>
                ) : (
                  <button
                    onClick={() => onToggleActive(sponsor)}
                    className={`px-3 py-2.5 rounded-full text-xs font-bold border-2 border-black transition-colors ${
                      sponsor.is_active ? 'bg-green-400 text-black' : 'bg-gray-200 text-gray-500'
                    }`}
                  >
                    {sponsor.is_active ? 'SÌ' : 'NO'}
                  </button>
                )}
              </td>
              {!readOnly && (
                <td className="p-3">
                  <div className="flex gap-2">
                    <button onClick={() => onEdit(sponsor)} className="px-2 py-2.5 text-purple font-bold text-xs rounded-md hover:bg-purple/5">
                      MODIFICA
                    </button>
                    <button onClick={() => onDelete(sponsor.id)} className="px-2 py-2.5 text-red-500 font-bold text-xs rounded-md hover:bg-red-500/5">
                      ELIMINA
                    </button>
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
