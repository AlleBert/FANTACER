/**
 * Risolve le dimensioni calcolate con CSS custom properties in valori px
 * espliciti PRIMA di una cattura html-to-image, e ne ripristina l'originale.
 *
 * html-to-image clona i nodi copiando `getComputedStyle().cssText`, che NON
 * serializza le CSS custom properties (es. `--sponsor-size`). Gli elementi che
 * dimensionano con `width: calc(var(--sponsor-size) * var(--sponsor-scale))`
 * perdono quindi le dimensioni nel clone → layout/card "sballate" nell'immagine.
 *
 * Questa funzione, dato il root della cattura, individua gli elementi con
 * custom property `--sponsor-size` e sovrascrive inline `width/height/flexBasis/
 * maxWidth/maxHeight` con i valori calcolati (px), restituendo una funzione di
 * restore da chiamare DOPO la cattura (try/finally).
 */

/** nome CSS (kebab) → accessor camelCase dello style */
const SIZING_PROPS: Array<[string, 'width' | 'height' | 'flexBasis' | 'maxWidth' | 'maxHeight']> = [
  ['width', 'width'],
  ['height', 'height'],
  ['flex-basis', 'flexBasis'],
  ['max-width', 'maxWidth'],
  ['max-height', 'maxHeight'],
]

export function resolveCustomPropertySizes(root: HTMLElement): () => void {
  const targets = Array.from(root.querySelectorAll<HTMLElement>('[style*="--sponsor-size"]'))
  if (targets.length === 0) return () => {}

  const originals = targets.map((el) => ({
    el,
    style: el.getAttribute('style'),
  }))

  for (const { el } of originals) {
    const cs = window.getComputedStyle(el)
    for (const [cssName, accessor] of SIZING_PROPS) {
      const value = cs.getPropertyValue(cssName)
      if (value) el.style[accessor] = value
    }
  }

  return () => {
    for (const { el, style } of originals) {
      if (style === null) el.removeAttribute('style')
      else el.setAttribute('style', style)
    }
  }
}