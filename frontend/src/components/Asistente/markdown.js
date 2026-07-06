// Mini renderer de Markdown -> HTML seguro (sin dependencias).
// Escapa el HTML de entrada y luego aplica un subconjunto de Markdown:
// encabezados, negrita, cursiva, código (inline y bloque), enlaces, listas
// (ordenadas y no), separadores, tablas y párrafos.

function escapar(texto) {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function inline(texto) {
  return texto
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/__([^_]+)__/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    // Enlaces [texto](url) — solo http(s) por seguridad
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
}

function celdas(linea) {
  return linea.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim())
}

const esFilaTabla   = l => /^\s*\|.*\|\s*$/.test(l)
const esSeparadora  = l => /^\s*\|?[\s:-]*-{2,}[\s:|-]*\|?\s*$/.test(l) && l.includes('-')
const esRegla       = l => /^\s*([-*_])\1{2,}\s*$/.test(l) // ---, ***, ___

export function renderMarkdown(md) {
  const lineas = escapar(md || '').split('\n')
  const html = []
  let tipoLista = null // 'ul' | 'ol' | null

  const cerrarLista = () => {
    if (tipoLista) { html.push(`</${tipoLista}>`); tipoLista = null }
  }
  const abrirLista = (tipo) => {
    if (tipoLista !== tipo) { cerrarLista(); html.push(`<${tipo}>`); tipoLista = tipo }
  }

  for (let i = 0; i < lineas.length; i++) {
    const l = lineas[i].trimEnd()

    // Bloque de código ``` ... ```
    if (/^\s*```/.test(l)) {
      cerrarLista()
      const buffer = []
      i++
      while (i < lineas.length && !/^\s*```/.test(lineas[i])) { buffer.push(lineas[i]); i++ }
      html.push(`<pre class="chatbot-code"><code>${buffer.join('\n')}</code></pre>`)
      continue
    }

    // Tabla Markdown (| ... | con fila separadora | --- |) -> tabla visual HTML.
    if (esFilaTabla(l) && i + 1 < lineas.length && esSeparadora(lineas[i + 1])) {
      cerrarLista()
      const encabezados = celdas(l)
      const filas = []
      i += 2
      while (i < lineas.length && esFilaTabla(lineas[i])) { filas.push(celdas(lineas[i])); i++ }
      i--
      html.push('<div class="chatbot-md-tabla-wrap"><table><thead><tr>')
      encabezados.forEach(c => html.push(`<th>${inline(c)}</th>`))
      html.push('</tr></thead><tbody>')
      filas.forEach(f => {
        html.push('<tr>')
        f.forEach(c => html.push(`<td>${inline(c)}</td>`))
        html.push('</tr>')
      })
      html.push('</tbody></table></div>')
      continue
    }

    // Separador horizontal
    if (esRegla(l)) { cerrarLista(); html.push('<hr>'); continue }

    if (!l.trim()) { cerrarLista(); continue }

    // Encabezados
    const h = l.match(/^(#{1,6})\s+(.*)$/)
    if (h) {
      cerrarLista()
      const nivel = Math.min(h[1].length + 2, 6) // # -> h3 para no chocar con títulos de la app
      html.push(`<h${nivel}>${inline(h[2])}</h${nivel}>`)
      continue
    }

    // Lista ordenada  "1. texto"
    const ol = l.match(/^\s*\d+[.)]\s+(.*)$/)
    if (ol) { abrirLista('ol'); html.push(`<li>${inline(ol[1])}</li>`); continue }

    // Lista no ordenada  "- texto" o "* texto"
    const ul = l.match(/^\s*[-*]\s+(.*)$/)
    if (ul) { abrirLista('ul'); html.push(`<li>${inline(ul[1])}</li>`); continue }

    cerrarLista()
    html.push(`<p>${inline(l)}</p>`)
  }
  cerrarLista()
  return html.join('')
}
