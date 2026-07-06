import { useEffect, useRef, useState } from 'react'
import { Bot, Trash2, Send, Mic, MicOff } from 'lucide-react'
import { asistenteApi } from '../../api/asistente'
import { renderMarkdown } from '../../components/Asistente/markdown'

const SALUDO = {
  role: 'assistant',
  content: '¡Hola! Soy el asistente de **ServiControl**. Podés preguntarme sobre la '
    + 'información a la que tenés acceso (proyectos, órdenes, finanzas, clientes, etc.). '
    + '¿En qué te ayudo?',
}

export default function AsistentePage() {
  const [modulos, setModulos] = useState([])
  const [mensajes, setMensajes] = useState([SALUDO])
  const [texto, setTexto] = useState('')
  const [cargando, setCargando] = useState(false)
  const [escuchando, setEscuchando] = useState(false)
  const [errorVoz, setErrorVoz] = useState('')
  const finRef = useRef(null)
  const recognitionRef = useRef(null)

  const vozSoportada = typeof window !== 'undefined' &&
    !!(window.SpeechRecognition || window.webkitSpeechRecognition)

  useEffect(() => {
    asistenteApi.modulos()
      .then(({ modulos }) => setModulos(modulos || []))
      .catch(() => setModulos([]))
  }, [])

  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mensajes])

  useEffect(() => () => { recognitionRef.current?.stop() }, [])

  function toggleDictado() {
    if (escuchando) { recognitionRef.current?.stop(); return }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) return
    const rec = new SpeechRecognition()
    rec.lang = 'es-ES'
    rec.interimResults = false
    rec.continuous = false
    rec.onresult = e => {
      const dicho = Array.from(e.results).map(r => r[0].transcript).join(' ').trim()
      setTexto(prev => (prev ? prev.trim() + ' ' : '') + dicho)
      setErrorVoz('')
    }
    rec.onerror = e => {
      setEscuchando(false)
      const MENSAJES = {
        'not-allowed':         'Permiso de micrófono denegado. Habilitalo en la configuración del navegador.',
        'permission-denied':   'Permiso de micrófono denegado. Habilitalo en la configuración del navegador.',
        'network':             'No se pudo conectar al servicio de voz. Verificá tu conexión a internet.',
        'service-not-allowed': 'El servicio de voz no está disponible en este navegador o dispositivo.',
        'audio-capture':       'No se detectó micrófono. Verificá que el dispositivo tenga uno activo.',
        'no-speech':           'No se detectó voz. Intentá hablar más cerca del micrófono.',
        'aborted':             '',
      }
      const msg = MENSAJES[e.error]
      if (msg) setErrorVoz(msg)
    }
    rec.onend = () => setEscuchando(false)
    recognitionRef.current = rec
    setEscuchando(true)
    setErrorVoz('')
    try {
      rec.start()
    } catch {
      setEscuchando(false)
      setErrorVoz('No se pudo iniciar el micrófono. Recargá la página e intentá de nuevo.')
    }
  }

  function limpiar() {
    setMensajes([SALUDO])
    setTexto('')
  }

  async function enviar(e) {
    e?.preventDefault()
    const pregunta = texto.trim()
    if (!pregunta || cargando) return

    const nuevos = [...mensajes, { role: 'user', content: pregunta }]
    setMensajes(nuevos)
    setTexto('')
    setCargando(true)

    const historial = nuevos
      .filter(m => m !== SALUDO)
      .slice(0, -1)
      .map(m => ({ role: m.role, content: m.content }))

    try {
      const res = await asistenteApi.consultar({ pregunta, historial })
      const respuesta = res.error || res.respuesta
      setMensajes(m => [...m, { role: 'assistant', content: respuesta }])
    } catch (err) {
      const msg = err?.error || 'No se pudo contactar al asistente. Intentá nuevamente.'
      setMensajes(m => [...m, { role: 'assistant', content: msg }])
    } finally {
      setCargando(false)
    }
  }

  return (
    <div className="asistente-page">
      <div className="asistente-header">
        <div className="asistente-header__title">
          <Bot size={20} />
          <div>
            <strong>Asistente ServiControl</strong>
            <span className="asistente-header__sub">
              {modulos.length} área{modulos.length === 1 ? '' : 's'} disponible{modulos.length === 1 ? '' : 's'} para consultar
            </span>
          </div>
        </div>
        <button
          className="btn btn-ghost"
          onClick={limpiar}
          disabled={cargando || mensajes.length <= 1}
          title="Borrar conversación"
        >
          <Trash2 size={15} /> Borrar conversación
        </button>
      </div>

      <div className="asistente-mensajes">
        {mensajes.map((m, i) => (
          <div key={i} className={`chatbot-msg chatbot-msg--${m.role}`}>
            {m.role === 'assistant'
              ? <div className="chatbot-md" dangerouslySetInnerHTML={{ __html: renderMarkdown(m.content) }} />
              : <div>{m.content}</div>}
          </div>
        ))}
        {cargando && (
          <div className="chatbot-msg chatbot-msg--assistant">
            <div className="chatbot-typing"><span></span><span></span><span></span></div>
          </div>
        )}
        <div ref={finRef} />
      </div>

      {errorVoz && <div className="asistente-error">{errorVoz}</div>}

      <form className="asistente-input" onSubmit={enviar}>
        <textarea
          value={texto}
          onChange={e => setTexto(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) enviar(e) }}
          placeholder="Escribí o dictá tu consulta…  (Enter para enviar, Shift+Enter para salto de línea)"
          rows={1}
          disabled={cargando}
        />
        {vozSoportada && (
          <button
            type="button"
            className={`asistente-mic${escuchando ? ' escuchando' : ''}`}
            onClick={toggleDictado}
            disabled={cargando}
            title={escuchando ? 'Detener dictado' : 'Dictar por voz'}
            aria-label={escuchando ? 'Detener dictado' : 'Dictar por voz'}
          >
            {escuchando ? <MicOff size={18} /> : <Mic size={18} />}
          </button>
        )}
        <button type="submit" disabled={cargando || !texto.trim()} aria-label="Enviar">
          <Send size={18} />
        </button>
      </form>
    </div>
  )
}
