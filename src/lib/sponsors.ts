export interface Sponsor {
  id: string
  name: string
  image_url: string | null
  website_url: string | null
  has_stand: boolean
}

/**
 * Fetch condivisa degli sponsor.
 *
 * `SponsorCards` è montato più volte in homepage (intro, classifica, footer):
 * senza cache ogni mount farebbe una richiesta identica a `/api/public/sponsors`.
 * Qui la promise è memoizzata a livello di modulo, quindi una sola richiesta per
 * caricamento pagina indipendentemente dal numero di consumer.
 *
 * `force = true` invalida la cache (usato dal cambio di `refreshKey`).
 */
let sponsorsPromise: Promise<Sponsor[]> | null = null

export function loadSponsors(force = false): Promise<Sponsor[]> {
  if (force) sponsorsPromise = null

  if (!sponsorsPromise) {
    sponsorsPromise = fetch('/api/public/sponsors')
      .then((res) => res.json())
      .then((data: { sponsors?: Sponsor[] }) => data.sponsors || [])
      .catch(() => {
        // Un errore non deve restare in cache: il prossimo mount ritenta.
        sponsorsPromise = null
        return []
      })
  }

  return sponsorsPromise
}

/** Solo per i test: azzera la cache modulo. */
export function resetSponsorsCache(): void {
  sponsorsPromise = null
}
