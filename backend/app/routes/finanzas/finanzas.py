from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from decimal import Decimal
from datetime import date, datetime
from collections import defaultdict
from sqlalchemy import func
from ...extensions import db
from ...models.finanzas.finanzas import Pago, GastoOrden
from ...utils.bitacora import log
from ...utils.permisos import requiere_permiso

bp = Blueprint('finanzas', __name__)

TIPOS_PAGO   = ('anticipo', 'pago_parcial', 'pago_final', 'otro')
METODOS_PAGO = ('efectivo', 'transferencia', 'QR', 'otro')
CONCEPTOS    = ('materiales', 'viaticos', 'transporte', 'otro')


# ── PAGOS ────────────────────────────────────────────────────────

@bp.get('/pagos')
@jwt_required()
@requiere_permiso('ver_finanzas')
def listar_pagos():
    pagos = Pago.query.order_by(Pago.fecha_pago.desc()).all()
    return jsonify([_serializar_pago(p) for p in pagos])


@bp.get('/pagos/proyecto/<int:id_proyecto>')
@jwt_required()
@requiere_permiso('ver_finanzas')
def pagos_por_proyecto(id_proyecto):
    pagos = Pago.query.filter_by(id_proyecto=id_proyecto).order_by(Pago.fecha_pago.desc()).all()
    total = sum(p.monto for p in pagos)
    return jsonify({'pagos': [_serializar_pago(p) for p in pagos], 'total_pagado': float(total)})


@bp.post('/pagos')
@jwt_required()
@requiere_permiso('gestionar_finanzas')
def registrar_pago():
    data = request.get_json()
    id_usuario = int(get_jwt_identity())

    for campo in ['id_proyecto', 'tipo_pago', 'monto', 'fecha_pago', 'metodo']:
        if not data.get(campo):
            return jsonify({'error': f'El campo {campo} es requerido'}), 400

    if data['tipo_pago'] not in TIPOS_PAGO:
        return jsonify({'error': 'Tipo de pago inválido'}), 400
    if data['metodo'] not in METODOS_PAGO:
        return jsonify({'error': 'Método de pago inválido'}), 400

    try:
        monto = Decimal(str(data['monto']))
        if monto <= 0:
            raise ValueError
    except (ValueError, Exception):
        return jsonify({'error': 'El monto debe ser un número positivo'}), 400

    pago = Pago(
        id_proyecto=data['id_proyecto'],
        id_usuario=id_usuario,
        tipo_pago=data['tipo_pago'],
        monto=monto,
        fecha_pago=data['fecha_pago'],
        metodo=data['metodo'],
        observacion=data.get('observacion', '').strip() or None,
    )
    db.session.add(pago)
    db.session.commit()
    log('REGISTRAR_PAGO', f"Pago {data['tipo_pago']} de Bs {monto} registrado para proyecto {data['id_proyecto']}",
        id_usuario=id_usuario, modulo='finanzas')
    return jsonify(_serializar_pago(pago)), 201


# ── GASTOS ───────────────────────────────────────────────────────

@bp.get('/gastos')
@jwt_required()
@requiere_permiso('ver_finanzas')
def listar_gastos():
    gastos = GastoOrden.query.order_by(GastoOrden.fecha_gasto.desc()).all()
    return jsonify([_serializar_gasto(g) for g in gastos])


@bp.get('/gastos/orden/<int:id_orden>')
@jwt_required()
@requiere_permiso('ver_finanzas')
def gastos_por_orden(id_orden):
    from ...models.ordenes.orden import OrdenTrabajo
    db.get_or_404(OrdenTrabajo, id_orden)
    gastos = GastoOrden.query.filter_by(id_orden=id_orden).order_by(GastoOrden.fecha_gasto.desc()).all()
    total = sum(float(g.monto) for g in gastos)
    return jsonify({'gastos': [_serializar_gasto(g) for g in gastos], 'total': total})


@bp.post('/gastos')
@jwt_required()
@requiere_permiso('gestionar_finanzas')
def registrar_gasto():
    data = request.get_json()
    id_usuario = int(get_jwt_identity())

    for campo in ['id_orden', 'concepto', 'monto', 'fecha_gasto']:
        if not data.get(campo):
            return jsonify({'error': f'El campo {campo} es requerido'}), 400

    if data['concepto'] not in CONCEPTOS:
        return jsonify({'error': 'Concepto inválido'}), 400

    try:
        monto = Decimal(str(data['monto']))
        if monto <= 0:
            raise ValueError
    except Exception:
        return jsonify({'error': 'El monto debe ser un número positivo'}), 400

    gasto = GastoOrden(
        id_orden=data['id_orden'],
        id_usuario=id_usuario,
        concepto=data['concepto'],
        descripcion=data.get('descripcion', '').strip() or None,
        monto=monto,
        fecha_gasto=data['fecha_gasto'],
    )
    db.session.add(gasto)
    db.session.commit()
    log('REGISTRAR_GASTO', f"Gasto '{data['concepto']}' de Bs {monto} en orden {data['id_orden']}",
        id_usuario=id_usuario, modulo='finanzas')
    return jsonify(_serializar_gasto(gasto)), 201


@bp.delete('/gastos/<int:id_gasto>')
@jwt_required()
@requiere_permiso('gestionar_finanzas')
def eliminar_gasto(id_gasto):
    gasto = db.get_or_404(GastoOrden, id_gasto)
    id_usuario = int(get_jwt_identity())
    log('ELIMINAR_GASTO', f"Gasto '{gasto.concepto}' de Bs {gasto.monto} en orden {gasto.id_orden} eliminado",
        id_usuario=id_usuario, modulo='finanzas')
    db.session.delete(gasto)
    db.session.commit()
    return jsonify({'ok': True})


# ── CU43: Reporte financiero ─────────────────────────────────────

@bp.get('/reporte')
@jwt_required()
@requiere_permiso('ver_finanzas')
def reporte_financiero():
    """CU43 — Genera un reporte consolidado de ingresos y gastos por período."""
    from ...models.proyectos.proyecto import Proyecto
    from ...models.entidades.entidad import Entidad
    from ...models.ordenes.orden import OrdenTrabajo

    fecha_inicio_str = request.args.get('fecha_inicio')
    fecha_fin_str    = request.args.get('fecha_fin')

    try:
        fi = datetime.strptime(fecha_inicio_str, '%Y-%m-%d').date() if fecha_inicio_str else None
        ff = datetime.strptime(fecha_fin_str,    '%Y-%m-%d').date() if fecha_fin_str    else None
    except ValueError:
        return jsonify({'error': 'Formato de fecha inválido. Use YYYY-MM-DD'}), 400

    # Construir queries con filtros opcionales de fecha
    q_pagos  = Pago.query
    q_gastos = GastoOrden.query
    if fi:
        q_pagos  = q_pagos.filter(Pago.fecha_pago >= fi)
        q_gastos = q_gastos.filter(GastoOrden.fecha_gasto >= fi)
    if ff:
        q_pagos  = q_pagos.filter(Pago.fecha_pago <= ff)
        q_gastos = q_gastos.filter(GastoOrden.fecha_gasto <= ff)

    pagos  = q_pagos.all()
    gastos = q_gastos.all()

    total_ingresos = sum(float(p.monto) for p in pagos)
    total_gastos   = sum(float(g.monto) for g in gastos)
    utilidad       = total_ingresos - total_gastos

    # Ingresos por tipo de pago
    ing_tipo = defaultdict(float)
    for p in pagos:
        ing_tipo[p.tipo_pago] += float(p.monto)
    por_tipo_pago = [
        {'tipo': k, 'total': v, 'porcentaje': round(v / total_ingresos * 100, 1) if total_ingresos else 0}
        for k, v in sorted(ing_tipo.items(), key=lambda x: x[1], reverse=True)
    ]

    # Gastos por concepto
    gas_concepto = defaultdict(float)
    for g in gastos:
        gas_concepto[g.concepto] += float(g.monto)
    por_concepto = [
        {'concepto': k, 'total': v, 'porcentaje': round(v / total_gastos * 100, 1) if total_gastos else 0}
        for k, v in sorted(gas_concepto.items(), key=lambda x: x[1], reverse=True)
    ]

    # Evolución mensual (ingresos y gastos por mes, en el período)
    meses_ing = defaultdict(float)
    meses_gas = defaultdict(float)
    for p in pagos:
        clave = p.fecha_pago.strftime('%Y-%m') if p.fecha_pago else 'sin-fecha'
        meses_ing[clave] += float(p.monto)
    for g in gastos:
        clave = g.fecha_gasto.strftime('%Y-%m') if g.fecha_gasto else 'sin-fecha'
        meses_gas[clave] += float(g.monto)
    todas_claves = sorted(set(list(meses_ing.keys()) + list(meses_gas.keys())))
    por_mes = [
        {'mes': k, 'ingresos': meses_ing.get(k, 0), 'gastos': meses_gas.get(k, 0)}
        for k in todas_claves
    ]

    # Desglose por proyecto
    proyectos_ing = defaultdict(float)
    for p in pagos:
        proyectos_ing[p.id_proyecto] += float(p.monto)

    # Para gastos necesitamos obtener el id_proyecto desde la orden
    proyectos_gas = defaultdict(float)
    ordenes_map   = {}
    ids_orden = list({g.id_orden for g in gastos})
    if ids_orden:
        ordenes = OrdenTrabajo.query.filter(OrdenTrabajo.id.in_(ids_orden)).all()
        ordenes_map = {o.id: o.id_proyecto for o in ordenes}
    for g in gastos:
        id_proy = ordenes_map.get(g.id_orden)
        if id_proy:
            proyectos_gas[id_proy] += float(g.monto)

    ids_proyecto = set(list(proyectos_ing.keys()) + list(proyectos_gas.keys()))
    por_proyecto = []
    if ids_proyecto:
        proyectos_obj = Proyecto.query.filter(Proyecto.id.in_(ids_proyecto)).all()
        entidades_map = {}
        ids_entidad = {p.id_entidad for p in proyectos_obj}
        if ids_entidad:
            ents = Entidad.query.filter(Entidad.id.in_(ids_entidad)).all()
            entidades_map = {e.id: e.nombre for e in ents}
        for p in proyectos_obj:
            ing = proyectos_ing.get(p.id, 0)
            gas = proyectos_gas.get(p.id, 0)
            por_proyecto.append({
                'id_proyecto': p.id,
                'codigo': p.codigo,
                'titulo': p.titulo,
                'cliente': entidades_map.get(p.id_entidad, '—'),
                'ingresos': ing,
                'gastos': gas,
                'utilidad': ing - gas,
            })
        por_proyecto.sort(key=lambda x: x['ingresos'], reverse=True)

    log('VER_REPORTE_FINANCIERO', 'Reporte financiero consultado',
        id_usuario=int(get_jwt_identity()), modulo='finanzas')

    return jsonify({
        'periodo': {'fecha_inicio': fecha_inicio_str, 'fecha_fin': fecha_fin_str},
        'resumen': {
            'total_ingresos': total_ingresos,
            'total_gastos': total_gastos,
            'utilidad': utilidad,
            'cantidad_pagos': len(pagos),
            'cantidad_gastos': len(gastos),
        },
        'por_tipo_pago': por_tipo_pago,
        'por_concepto_gasto': por_concepto,
        'por_mes': por_mes,
        'por_proyecto': por_proyecto,
    })


# ── CU36: Cuentas por cobrar ──────────────────────────────────────

@bp.get('/cuentas-por-cobrar')
@jwt_required()
@requiere_permiso('ver_finanzas')
def cuentas_por_cobrar():
    """CU36 — Consultar cuentas por cobrar.

    Calcula el saldo pendiente por proyecto: total cotización aprobada minus pagos recibidos.
    No depende de ninguna vista SQL; usa ORM directamente.
    """
    from ...models.proyectos.proyecto import Proyecto
    from ...models.cotizaciones.cotizacion import Cotizacion, CotizacionDetalle
    from ...models.entidades.entidad import Entidad

    # Proyectos vinculados a una cotización aprobada
    proyectos = (
        db.session.query(Proyecto)
        .join(Cotizacion, Proyecto.id_cotizacion == Cotizacion.id)
        .filter(Cotizacion.estado.in_(['aprobada', 'convertida']))
        .all()
    )

    resultado = []
    for p in proyectos:
        cotizacion = db.session.get(Cotizacion, p.id_cotizacion)
        if not cotizacion:
            continue

        # Monto total: suma de subtotales de detalles de cotización
        monto_total = db.session.query(
            func.coalesce(func.sum(CotizacionDetalle.subtotal), 0)
        ).filter_by(id_cotizacion=cotizacion.id).scalar() or 0

        # Total pagado para este proyecto
        total_pagado = db.session.query(
            func.coalesce(func.sum(Pago.monto), 0)
        ).filter_by(id_proyecto=p.id).scalar() or 0

        saldo = float(monto_total) - float(total_pagado)
        if saldo <= 0:
            continue

        entidad = db.session.get(Entidad, p.id_entidad)
        resultado.append({
            'id_proyecto': p.id,
            'codigo_proyecto': p.codigo,
            'titulo_proyecto': p.titulo,
            'cliente': entidad.nombre if entidad else '—',
            'monto_total_cotizacion': float(monto_total),
            'total_pagado': float(total_pagado),
            'saldo_pendiente': saldo,
        })

    resultado.sort(key=lambda x: x['saldo_pendiente'], reverse=True)
    return jsonify(resultado)


def _serializar_pago(p: Pago) -> dict:
    return {
        'id': p.id,
        'id_proyecto': p.id_proyecto,
        'tipo_pago': p.tipo_pago,
        'metodo': p.metodo,
        'monto': float(p.monto),
        'fecha_pago': p.fecha_pago.isoformat() if p.fecha_pago else None,
        'observacion': p.observacion,
        'stripe_payment_intent_id': getattr(p, 'stripe_payment_intent_id', None),
        'stripe_status': getattr(p, 'stripe_status', None),
        'fecha_registro': p.fecha_registro.isoformat() if p.fecha_registro else None,
    }


def _serializar_gasto(g: GastoOrden) -> dict:
    from ...models.seguridad.auth import Usuario
    usuario = db.session.get(Usuario, g.id_usuario)
    return {
        'id': g.id,
        'id_orden': g.id_orden,
        'id_usuario': g.id_usuario,
        'usuario': usuario.username if usuario else '—',
        'concepto': g.concepto,
        'descripcion': g.descripcion,
        'monto': float(g.monto),
        'fecha_gasto': g.fecha_gasto.isoformat() if g.fecha_gasto else None,
        'fecha_registro': g.fecha_registro.isoformat() if g.fecha_registro else None,
    }
