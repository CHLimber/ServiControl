import { useState } from 'react'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { finanzasApi } from '../api/finanzas'
import { CreditCard, X, CheckCircle } from 'lucide-react'

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY || '')

const TIPOS_PAGO = ['anticipo', 'pago_parcial', 'pago_final', 'otro']

const CARD_STYLE = {
  style: {
    base: {
      fontSize: '14px',
      color: '#1f2937',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      '::placeholder': { color: '#9ca3af' },
    },
    invalid: { color: '#ef4444' },
  },
}

function hoy() {
  return new Date().toISOString().split('T')[0]
}

function StripeForm({ proyectos, onSuccess, onClose }) {
  const stripe   = useStripe()
  const elements = useElements()

  const [form, setForm] = useState({
    id_proyecto: '',
    tipo_pago:   'anticipo',
    monto:       '',
    fecha_pago:  hoy(),
    observacion: '',
  })
  const [estado, setEstado] = useState('idle') // idle | procesando | exito
  const [error,  setError]  = useState('')

  function set(campo) {
    return e => setForm(f => ({ ...f, [campo]: e.target.value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (!form.id_proyecto || !form.monto || !form.fecha_pago) {
      setError('Proyecto, monto y fecha son obligatorios.')
      return
    }
    if (!stripe || !elements) {
      setError('Stripe no está listo. Recargue la página.')
      return
    }

    setEstado('procesando')

    try {
      // 1. Crear PaymentIntent en el backend
      const { client_secret, payment_intent_id } = await finanzasApi.crearStripeIntent({
        id_proyecto: Number(form.id_proyecto),
        tipo_pago:   form.tipo_pago,
        monto:       Number(form.monto),
      })

      // 2. Confirmar el pago con la tarjeta ingresada
      const { error: stripeErr, paymentIntent } = await stripe.confirmCardPayment(client_secret, {
        payment_method: { card: elements.getElement(CardElement) },
      })

      if (stripeErr) {
        setError(stripeErr.message)
        setEstado('idle')
        return
      }

      if (paymentIntent.status !== 'succeeded') {
        setError(`Estado inesperado del pago: ${paymentIntent.status}. Contacte soporte.`)
        setEstado('idle')
        return
      }

      // 3. Registrar el pago en la base de datos
      const nuevoPago = await finanzasApi.completarPagoStripe({
        payment_intent_id,
        id_proyecto: Number(form.id_proyecto),
        tipo_pago:   form.tipo_pago,
        monto:       Number(form.monto),
        fecha_pago:  form.fecha_pago,
        observacion: form.observacion,
      })

      setEstado('exito')
      setTimeout(() => onSuccess(nuevoPago), 1200)

    } catch (err) {
      setError(err?.error || 'Error procesando el pago. Intente nuevamente.')
      setEstado('idle')
    }
  }

  const procesando = estado === 'procesando'
  const exito      = estado === 'exito'

  return (
    <form onSubmit={handleSubmit}>
      <div className="modal-body">
        {exito ? (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <CheckCircle size={48} color="var(--success)" style={{ marginBottom: 12 }} />
            <p style={{ fontWeight: 600, fontSize: 16 }}>¡Pago procesado con éxito!</p>
          </div>
        ) : (
          <div className="form-grid">
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label className="form-label">Proyecto *</label>
              <select className="input" value={form.id_proyecto} onChange={set('id_proyecto')} disabled={procesando}>
                <option value="">Seleccioná un proyecto</option>
                {proyectos.map(p => (
                  <option key={p.id} value={p.id}>{p.codigo} — {p.titulo}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Tipo de pago *</label>
              <select className="input" value={form.tipo_pago} onChange={set('tipo_pago')} disabled={procesando}>
                {TIPOS_PAGO.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Monto (Bs) *</label>
              <input
                type="number" className="input" min="0.01" step="0.01"
                value={form.monto} onChange={set('monto')}
                placeholder="0.00" disabled={procesando}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Fecha *</label>
              <input
                type="date" className="input"
                value={form.fecha_pago} onChange={set('fecha_pago')}
                disabled={procesando}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Observación</label>
              <input
                type="text" className="input"
                value={form.observacion} onChange={set('observacion')}
                placeholder="Referencia o comentario..." disabled={procesando}
              />
            </div>

            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label className="form-label">Datos de tarjeta *</label>
              <div style={{
                border: '1px solid var(--border)',
                borderRadius: 6,
                padding: '10px 12px',
                background: 'var(--input-bg, #fff)',
              }}>
                <CardElement options={CARD_STYLE} />
              </div>
              <p className="text-muted text-sm" style={{ marginTop: 6 }}>
                Tarjeta de prueba: <code>4242 4242 4242 4242</code> · Cualquier fecha futura · Cualquier CVV
              </p>
            </div>

            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <div style={{
                background: 'var(--info-bg, #eff6ff)',
                border: '1px solid var(--info-border, #bfdbfe)',
                borderRadius: 6,
                padding: '8px 12px',
                fontSize: 12,
                color: 'var(--info-text, #1d4ed8)',
              }}>
                Los pagos se procesan de forma segura a través de Stripe con cifrado SSL.
              </div>
            </div>
          </div>
        )}

        {error && <div className="alert alert-danger" style={{ marginTop: 12 }}>{error}</div>}
      </div>

      {!exito && (
        <div className="modal-footer">
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={procesando}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary" disabled={!stripe || procesando}>
            <CreditCard size={14} style={{ marginRight: 6 }} />
            {procesando ? 'Procesando...' : 'Pagar con Stripe'}
          </button>
        </div>
      )}
    </form>
  )
}

export default function PagoStripeModal({ proyectos, onSuccess, onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 500 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <CreditCard size={18} />
            Pagar con Stripe
          </h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose}><X size={14} /></button>
        </div>
        {stripePromise ? (
          <Elements stripe={stripePromise}>
            <StripeForm proyectos={proyectos} onSuccess={onSuccess} onClose={onClose} />
          </Elements>
        ) : (
          <div className="modal-body">
            <div className="alert alert-danger">
              VITE_STRIPE_PUBLIC_KEY no está configurado en el .env del frontend.
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
