"""CU42 — Pasarela de pago Stripe."""
from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from decimal import Decimal

from ...extensions import db
from ...models.finanzas.finanzas import Pago
from ...utils.bitacora import log
from ...utils.permisos import requiere_permiso

bp_stripe = Blueprint('finanzas_stripe', __name__)

TIPOS_PAGO = ('anticipo', 'pago_parcial', 'pago_final', 'otro')


@bp_stripe.post('/stripe/crear-intent')
@jwt_required()
@requiere_permiso('gestionar_finanzas')
def crear_payment_intent():
    """Crea un PaymentIntent en Stripe y devuelve el client_secret al frontend."""
    import stripe

    data = request.get_json()
    for campo in ['monto', 'id_proyecto', 'tipo_pago']:
        if not data.get(campo):
            return jsonify({'error': f'El campo {campo} es requerido'}), 400

    if data['tipo_pago'] not in TIPOS_PAGO:
        return jsonify({'error': 'Tipo de pago inválido'}), 400

    try:
        monto = Decimal(str(data['monto']))
        if monto <= 0:
            raise ValueError
    except (ValueError, Exception):
        return jsonify({'error': 'El monto debe ser un número positivo'}), 400

    stripe.api_key = current_app.config.get('STRIPE_SECRET_KEY', '')
    if not stripe.api_key or 'REEMPLAZAR' in stripe.api_key:
        return jsonify({'error': 'Stripe no está configurado. Agregue STRIPE_SECRET_KEY al .env'}), 503

    monto_centavos = int(monto * 100)

    try:
        intent = stripe.PaymentIntent.create(
            amount=monto_centavos,
            currency='usd',
            metadata={
                'id_proyecto': str(data['id_proyecto']),
                'tipo_pago': data['tipo_pago'],
                'id_usuario': str(get_jwt_identity()),
            },
        )
    except stripe.error.StripeError as e:
        return jsonify({'error': str(e)}), 400

    return jsonify({
        'client_secret': intent.client_secret,
        'payment_intent_id': intent.id,
    })


@bp_stripe.post('/stripe/completar')
@jwt_required()
@requiere_permiso('gestionar_finanzas')
def completar_pago_stripe():
    """Verifica con Stripe que el pago fue exitoso y lo persiste en la BD."""
    import stripe

    data = request.get_json()
    id_usuario = int(get_jwt_identity())

    for campo in ['payment_intent_id', 'id_proyecto', 'tipo_pago', 'monto', 'fecha_pago']:
        if not data.get(campo):
            return jsonify({'error': f'El campo {campo} es requerido'}), 400

    stripe.api_key = current_app.config.get('STRIPE_SECRET_KEY', '')

    try:
        intent = stripe.PaymentIntent.retrieve(data['payment_intent_id'])
    except stripe.error.StripeError as e:
        return jsonify({'error': str(e)}), 400

    if intent.status != 'succeeded':
        return jsonify({'error': f'El pago no fue completado (estado: {intent.status})'}), 400

    existente = Pago.query.filter_by(stripe_payment_intent_id=data['payment_intent_id']).first()
    if existente:
        return jsonify({'error': 'Este pago ya fue registrado', 'id': existente.id}), 409

    try:
        monto = Decimal(str(data['monto']))
    except Exception:
        return jsonify({'error': 'Monto inválido'}), 400

    pago = Pago(
        id_proyecto=data['id_proyecto'],
        id_usuario=id_usuario,
        tipo_pago=data['tipo_pago'],
        monto=monto,
        fecha_pago=data['fecha_pago'],
        metodo='stripe',
        observacion=data.get('observacion', '').strip() or None,
        stripe_payment_intent_id=data['payment_intent_id'],
        stripe_status='succeeded',
    )
    db.session.add(pago)
    db.session.commit()

    log(
        'PAGO_STRIPE',
        f"Pago Stripe {data['tipo_pago']} de USD {monto} para proyecto {data['id_proyecto']}",
        id_usuario=id_usuario,
        modulo='finanzas',
    )

    # Generar factura PDF y guardarla en documentos del proyecto
    try:
        from ...utils.factura import generar_y_guardar_factura
        generar_y_guardar_factura(pago, id_usuario, current_app.config['UPLOAD_FOLDER'])
    except Exception as exc:
        current_app.logger.warning(f"No se pudo generar la factura PDF: {exc}")

    return jsonify({
        'id': pago.id,
        'id_proyecto': pago.id_proyecto,
        'tipo_pago': pago.tipo_pago,
        'metodo': pago.metodo,
        'monto': float(pago.monto),
        'fecha_pago': pago.fecha_pago.isoformat() if pago.fecha_pago else None,
        'observacion': pago.observacion,
        'stripe_payment_intent_id': pago.stripe_payment_intent_id,
        'stripe_status': pago.stripe_status,
        'fecha_registro': pago.fecha_registro.isoformat() if pago.fecha_registro else None,
    }), 201


@bp_stripe.post('/stripe/webhook')
def stripe_webhook():
    """Webhook de Stripe para confirmar pagos en producción (requiere STRIPE_WEBHOOK_SECRET)."""
    import stripe

    payload = request.get_data()
    sig_header = request.headers.get('Stripe-Signature', '')
    webhook_secret = current_app.config.get('STRIPE_WEBHOOK_SECRET', '')

    if not webhook_secret or 'REEMPLAZAR' in webhook_secret:
        return jsonify({'ok': True})

    try:
        event = stripe.Webhook.construct_event(payload, sig_header, webhook_secret)
    except (ValueError, stripe.error.SignatureVerificationError):
        return jsonify({'error': 'Firma inválida'}), 400

    if event['type'] == 'payment_intent.succeeded':
        pi = event['data']['object']
        pago = Pago.query.filter_by(stripe_payment_intent_id=pi['id']).first()
        if pago and pago.stripe_status != 'succeeded':
            pago.stripe_status = 'succeeded'
            db.session.commit()

    return jsonify({'ok': True})
