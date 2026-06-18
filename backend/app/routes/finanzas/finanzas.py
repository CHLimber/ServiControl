from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from decimal import Decimal
from datetime import date, datetime
from collections import defaultdict
from sqlalchemy import func
from ...extensions import db
from ...models.finanzas.finanzas import Pago, GastoOrden
from ...utils.bitacora import log
from ...utils.permisos import requiere_permiso
from ...utils import notificaciones

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

    notificaciones.emitir_a_permiso(
        'ver_finanzas', 'pago_registrado',
        'Nuevo pago registrado',
        f"Se registró un pago de tipo «{data['tipo_pago']}» por Bs {monto} "
        f"en el proyecto #{data['id_proyecto']}.",
        url='/finanzas', excluir_usuario=id_usuario,
    )

    try:
        from ...utils.factura import generar_y_guardar_factura
        generar_y_guardar_factura(pago, id_usuario, current_app.config['UPLOAD_FOLDER'])
    except Exception as exc:
        current_app.logger.warning(f"No se pudo generar la factura PDF: {exc}")

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
    concepto  = gasto.concepto
    monto_log = gasto.monto
    id_orden  = gasto.id_orden
    db.session.delete(gasto)
    db.session.commit()
    log('ELIMINAR_GASTO', f"Gasto '{concepto}' de Bs {monto_log} en orden {id_orden} eliminado",
        id_usuario=id_usuario, modulo='finanzas')
    return jsonify({'ok': True})


# ── CU43: Reporte financiero (personalizado desde la interfaz) ──

def _filtros_reporte(args):
    """Lee y valida los filtros del reporte personalizado (interfaz)."""
    fecha_inicio_str = args.get('fecha_inicio')
    fecha_fin_str    = args.get('fecha_fin')

    fi = datetime.strptime(fecha_inicio_str, '%Y-%m-%d').date() if fecha_inicio_str else None
    ff = datetime.strptime(fecha_fin_str,    '%Y-%m-%d').date() if fecha_fin_str    else None

    return {
        'fecha_inicio': fecha_inicio_str,
        'fecha_fin':    fecha_fin_str,
        'fi':           fi,
        'ff':           ff,
        'tipo_pago':    (args.get('tipo_pago') or '').strip(),
        'metodo':       (args.get('metodo') or '').strip(),
        'concepto':     (args.get('concepto') or '').strip(),
        'id_proyecto':  args.get('id_proyecto', type=int),
        'id_entidad':   args.get('id_entidad', type=int),
    }


def _consultas_filtradas(f):
    """Aplica todos los filtros del reporte personalizado a pagos y gastos."""
    from ...models.ordenes.orden import OrdenTrabajo

    q_pagos  = Pago.query
    q_gastos = GastoOrden.query
    if f['fi']:
        q_pagos  = q_pagos.filter(Pago.fecha_pago >= f['fi'])
        q_gastos = q_gastos.filter(GastoOrden.fecha_gasto >= f['fi'])
    if f['ff']:
        q_pagos  = q_pagos.filter(Pago.fecha_pago <= f['ff'])
        q_gastos = q_gastos.filter(GastoOrden.fecha_gasto <= f['ff'])
    if f['tipo_pago']:
        q_pagos = q_pagos.filter(Pago.tipo_pago == f['tipo_pago'])
    if f['metodo']:
        q_pagos = q_pagos.filter(Pago.metodo == f['metodo'])
    if f['concepto']:
        q_gastos = q_gastos.filter(GastoOrden.concepto == f['concepto'])
    if f['id_proyecto']:
        q_pagos  = q_pagos.filter(Pago.id_proyecto == f['id_proyecto'])
        q_gastos = (q_gastos
                    .join(OrdenTrabajo, OrdenTrabajo.id == GastoOrden.id_orden)
                    .filter(OrdenTrabajo.id_proyecto == f['id_proyecto']))
    if f['id_entidad']:
        from ...models.proyectos.proyecto import Proyecto
        # Resolvemos los proyectos/órdenes del cliente para no chocar con el join anterior
        proy_ids = [p.id for p in Proyecto.query.filter_by(id_entidad=f['id_entidad']).all()] or [-1]
        orden_ids = [o.id for o in OrdenTrabajo.query.filter(OrdenTrabajo.id_proyecto.in_(proy_ids)).all()] or [-1]
        q_pagos  = q_pagos.filter(Pago.id_proyecto.in_(proy_ids))
        q_gastos = q_gastos.filter(GastoOrden.id_orden.in_(orden_ids))
    return q_pagos, q_gastos


def _construir_reporte_financiero(f):
    from ...models.proyectos.proyecto import Proyecto
    from ...models.entidades.entidad import Entidad
    from ...models.ordenes.orden import OrdenTrabajo

    q_pagos, q_gastos = _consultas_filtradas(f)
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

    return {
        'periodo': {'fecha_inicio': f['fecha_inicio'], 'fecha_fin': f['fecha_fin']},
        'filtros': {
            'tipo_pago':   f['tipo_pago'] or None,
            'metodo':      f['metodo'] or None,
            'concepto':    f['concepto'] or None,
            'id_proyecto': f['id_proyecto'],
            'id_entidad':  f['id_entidad'],
        },
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
    }


@bp.get('/reporte')
@jwt_required()
@requiere_permiso('ver_finanzas')
def reporte_financiero():
    """CU43 — Reporte personalizado: el usuario elige filtros desde la interfaz."""
    try:
        f = _filtros_reporte(request.args)
    except ValueError:
        return jsonify({'error': 'Formato de fecha inválido. Use YYYY-MM-DD'}), 400

    reporte = _construir_reporte_financiero(f)
    log('VER_REPORTE_FINANCIERO', 'Reporte financiero consultado',
        id_usuario=int(get_jwt_identity()), modulo='finanzas')
    return jsonify(reporte)


@bp.get('/reporte/exportar')
@jwt_required()
@requiere_permiso('ver_finanzas')
def exportar_reporte_financiero():
    """Exporta el reporte personalizado (con sus filtros) en PDF o Excel."""
    from ...utils.reportes import exportar_secciones_pdf, exportar_secciones_xlsx
    from ...utils.timezone import ahora_bolivia

    formato = (request.args.get('formato') or 'pdf').lower()
    if formato not in ('pdf', 'xlsx'):
        return jsonify({'error': 'Formato no soportado (use pdf o xlsx)'}), 400

    try:
        f = _filtros_reporte(request.args)
    except ValueError:
        return jsonify({'error': 'Formato de fecha inválido. Use YYYY-MM-DD'}), 400

    r = _construir_reporte_financiero(f)

    subtitulos = []
    if f['fecha_inicio'] or f['fecha_fin']:
        subtitulos.append(f"Período: {f['fecha_inicio'] or '—'} al {f['fecha_fin'] or '—'}")
    aplicados = [
        f'{etiqueta}: {valor}'
        for etiqueta, valor in [
            ('Tipo de pago', f['tipo_pago']), ('Método', f['metodo']),
            ('Concepto de gasto', f['concepto']), ('Proyecto', f['id_proyecto']),
            ('Cliente', f['id_entidad']),
        ] if valor
    ]
    if aplicados:
        subtitulos.append('Filtros: ' + ', '.join(aplicados))

    res = r['resumen']
    secciones = [
        {
            'titulo': 'Resumen',
            'columnas': ['Métrica', 'Valor'],
            'filas': [
                ['Total ingresos (Bs)', res['total_ingresos']],
                ['Total gastos (Bs)',   res['total_gastos']],
                ['Utilidad (Bs)',       res['utilidad']],
                ['Cantidad de pagos',   res['cantidad_pagos']],
                ['Cantidad de gastos',  res['cantidad_gastos']],
            ],
        },
        {
            'titulo': 'Ingresos por tipo de pago',
            'columnas': ['Tipo', 'Total (Bs)', '%'],
            'filas': [[x['tipo'], x['total'], x['porcentaje']] for x in r['por_tipo_pago']],
        },
        {
            'titulo': 'Gastos por concepto',
            'columnas': ['Concepto', 'Total (Bs)', '%'],
            'filas': [[x['concepto'], x['total'], x['porcentaje']] for x in r['por_concepto_gasto']],
        },
        {
            'titulo': 'Evolución mensual',
            'columnas': ['Mes', 'Ingresos (Bs)', 'Gastos (Bs)'],
            'filas': [[x['mes'], x['ingresos'], x['gastos']] for x in r['por_mes']],
        },
        {
            'titulo': 'Detalle por proyecto',
            'columnas': ['Código', 'Proyecto', 'Cliente', 'Ingresos (Bs)', 'Gastos (Bs)', 'Utilidad (Bs)'],
            'filas': [
                [x['codigo'], x['titulo'], x['cliente'], x['ingresos'], x['gastos'], x['utilidad']]
                for x in r['por_proyecto']
            ],
        },
    ]
    secciones = [s for s in secciones if s['filas']]

    log('EXPORTAR_REPORTE_FINANCIERO', f'Reporte financiero exportado en {formato.upper()}',
        id_usuario=int(get_jwt_identity()), modulo='finanzas')

    marca = ahora_bolivia().strftime('%Y%m%d_%H%M')
    nombre = f'reporte_financiero_{marca}'
    titulo = 'ServiControl — Reporte financiero'
    if formato == 'xlsx':
        return exportar_secciones_xlsx(titulo, subtitulos, secciones, nombre)
    return exportar_secciones_pdf(titulo, subtitulos, secciones, nombre, orientacion='L')


# ── Reporte por IA (Claude) — analiza los datos y responde en lenguaje natural ──

def _contexto_financiero_texto(r):
    """Convierte el reporte financiero en un resumen textual compacto para enviar a Claude."""
    res = r['resumen']
    lineas = [
        f"Período: {r['periodo']['fecha_inicio']} a {r['periodo']['fecha_fin']}",
        '',
        'RESUMEN GENERAL:',
        f"- Total ingresos: Bs {res['total_ingresos']:.2f} ({res['cantidad_pagos']} pagos)",
        f"- Total gastos: Bs {res['total_gastos']:.2f} ({res['cantidad_gastos']} registros)",
        f"- Utilidad neta: Bs {res['utilidad']:.2f}",
    ]

    if r['por_tipo_pago']:
        lineas += ['', 'INGRESOS POR TIPO DE PAGO:']
        lineas += [f"- {x['tipo']}: Bs {x['total']:.2f} ({x['porcentaje']}%)" for x in r['por_tipo_pago']]

    if r['por_concepto_gasto']:
        lineas += ['', 'GASTOS POR CONCEPTO:']
        lineas += [f"- {x['concepto']}: Bs {x['total']:.2f} ({x['porcentaje']}%)" for x in r['por_concepto_gasto']]

    if r['por_mes']:
        lineas += ['', 'EVOLUCIÓN MENSUAL (mes: ingresos / gastos):']
        lineas += [f"- {x['mes']}: Bs {x['ingresos']:.2f} / Bs {x['gastos']:.2f}" for x in r['por_mes']]

    if r['por_proyecto']:
        lineas += ['', 'DETALLE POR PROYECTO (top por ingresos):']
        lineas += [
            f"- [{x['codigo']}] {x['titulo']} ({x['cliente']}): "
            f"ingresos Bs {x['ingresos']:.2f}, gastos Bs {x['gastos']:.2f}, utilidad Bs {x['utilidad']:.2f}"
            for x in r['por_proyecto'][:20]
        ]

    return '\n'.join(lineas)


SYSTEM_IA_FINANZAS = (
    "Eres un analista financiero senior de ServiControl, una empresa boliviana de "
    "seguridad electrónica. Recibes datos financieros reales (ingresos, gastos, utilidad "
    "por período, tipo de pago, concepto y proyecto) y la consulta de un usuario. "
    "Respondé en español, de forma clara y profesional, basándote ÚNICAMENTE en los datos "
    "proporcionados. Todos los montos están en bolivianos (Bs). Si la consulta pide algo que "
    "los datos no permiten responder, indicálo con honestidad. Cuando sea útil, resaltá "
    "tendencias, riesgos (p. ej. baja utilidad o gastos altos) y recomendaciones accionables. "
    "Usá viñetas y secciones breves; no inventes cifras que no estén en los datos."
)


@bp.post('/reporte/ia')
@jwt_required()
@requiere_permiso('ver_finanzas')
def reporte_financiero_ia():
    """Reporte por IA: el usuario hace una consulta en lenguaje natural y Claude la responde
    sobre los datos financieros del período indicado (por defecto, el año en curso)."""
    data = request.get_json() or {}
    consulta = (data.get('consulta') or '').strip()
    if not consulta:
        return jsonify({'error': 'La consulta es requerida.'}), 400

    api_key = current_app.config.get('ANTHROPIC_API_KEY')
    if not api_key:
        return jsonify({'error': 'El reporte por IA no está configurado (falta ANTHROPIC_API_KEY).'}), 503

    # Período: usa el provisto o, por defecto, desde el inicio del año actual hasta hoy
    hoy = date.today()
    args = {
        'fecha_inicio': data.get('fecha_inicio') or f'{hoy.year}-01-01',
        'fecha_fin':    data.get('fecha_fin')    or hoy.isoformat(),
    }
    try:
        f = _filtros_reporte(args)
    except ValueError:
        return jsonify({'error': 'Formato de fecha inválido. Use YYYY-MM-DD'}), 400

    reporte = _construir_reporte_financiero(f)
    contexto = _contexto_financiero_texto(reporte)

    prompt = (
        f"Datos financieros de la empresa:\n\n{contexto}\n\n"
        f"Consulta del usuario:\n{consulta}"
    )

    try:
        import anthropic
        client = anthropic.Anthropic(api_key=api_key)
        respuesta = client.messages.create(
            model=current_app.config.get('ANTHROPIC_MODEL', 'claude-opus-4-8'),
            max_tokens=4096,
            system=SYSTEM_IA_FINANZAS,
            messages=[{'role': 'user', 'content': prompt}],
        )
        analisis = ''.join(
            bloque.text for bloque in respuesta.content if getattr(bloque, 'type', None) == 'text'
        ).strip()
    except ImportError:
        return jsonify({'error': 'El paquete anthropic no está instalado en el servidor.'}), 503
    except Exception as exc:  # noqa: BLE001
        current_app.logger.warning(f'Error al generar el reporte por IA: {exc}')
        return jsonify({'error': 'No se pudo generar el análisis por IA. Intentá nuevamente.'}), 502

    log('VER_REPORTE_IA', f'Reporte financiero por IA consultado: "{consulta[:120]}"',
        id_usuario=int(get_jwt_identity()), modulo='finanzas')

    return jsonify({
        'consulta': consulta,
        'analisis': analisis,
        'periodo': reporte['periodo'],
        'resumen': reporte['resumen'],
    })


# ── Reportes estáticos (consulta SQL fija, sin parámetros) ──────

REPORTES_ESTATICOS = {
    'ingresos_por_mes': {
        'titulo': 'Ingresos por mes (año actual)',
        'descripcion': 'Total cobrado y cantidad de pagos por mes del año en curso.',
        'columnas': ['Mes', 'Pagos', 'Total (Bs)'],
        'sql': """
            SELECT DATE_FORMAT(fecha_pago, '%Y-%m') AS mes,
                   COUNT(*) AS pagos,
                   SUM(monto) AS total
            FROM pago
            WHERE YEAR(fecha_pago) = YEAR(CURDATE())
            GROUP BY mes
            ORDER BY mes
        """,
    },
    'flujo_caja_mensual': {
        'titulo': 'Flujo de caja mensual (año actual)',
        'descripcion': 'Ingresos, gastos y utilidad neta por mes del año en curso.',
        'columnas': ['Mes', 'Ingresos (Bs)', 'Gastos (Bs)', 'Utilidad (Bs)'],
        'sql': """
            SELECT m.mes AS mes,
                   COALESCE(i.total, 0) AS ingresos,
                   COALESCE(g.total, 0) AS gastos,
                   COALESCE(i.total, 0) - COALESCE(g.total, 0) AS utilidad
            FROM (
                SELECT DATE_FORMAT(fecha_pago, '%Y-%m') AS mes FROM pago
                WHERE YEAR(fecha_pago) = YEAR(CURDATE())
                UNION
                SELECT DATE_FORMAT(fecha_gasto, '%Y-%m') AS mes FROM gasto_orden
                WHERE YEAR(fecha_gasto) = YEAR(CURDATE())
            ) m
            LEFT JOIN (
                SELECT DATE_FORMAT(fecha_pago, '%Y-%m') AS mes, SUM(monto) AS total
                FROM pago WHERE YEAR(fecha_pago) = YEAR(CURDATE()) GROUP BY mes
            ) i ON i.mes = m.mes
            LEFT JOIN (
                SELECT DATE_FORMAT(fecha_gasto, '%Y-%m') AS mes, SUM(monto) AS total
                FROM gasto_orden WHERE YEAR(fecha_gasto) = YEAR(CURDATE()) GROUP BY mes
            ) g ON g.mes = m.mes
            ORDER BY m.mes
        """,
    },
    'gastos_por_concepto': {
        'titulo': 'Gastos por concepto (año actual)',
        'descripcion': 'Total gastado por concepto en el año en curso.',
        'columnas': ['Concepto', 'Registros', 'Total (Bs)'],
        'sql': """
            SELECT concepto,
                   COUNT(*) AS registros,
                   SUM(monto) AS total
            FROM gasto_orden
            WHERE YEAR(fecha_gasto) = YEAR(CURDATE())
            GROUP BY concepto
            ORDER BY total DESC
        """,
    },
    'utilidad_por_proyecto': {
        'titulo': 'Utilidad por proyecto (histórico)',
        'descripcion': 'Ingresos, gastos y utilidad acumulados de cada proyecto con movimientos.',
        'columnas': ['Código', 'Proyecto', 'Ingresos (Bs)', 'Gastos (Bs)', 'Utilidad (Bs)'],
        'sql': """
            SELECT p.codigo,
                   p.titulo,
                   COALESCE(i.total, 0) AS ingresos,
                   COALESCE(g.total, 0) AS gastos,
                   COALESCE(i.total, 0) - COALESCE(g.total, 0) AS utilidad
            FROM proyecto p
            LEFT JOIN (
                SELECT id_proyecto, SUM(monto) AS total FROM pago GROUP BY id_proyecto
            ) i ON i.id_proyecto = p.id
            LEFT JOIN (
                SELECT ot.id_proyecto, SUM(go.monto) AS total
                FROM gasto_orden go
                JOIN orden_trabajo ot ON ot.id = go.id_orden
                GROUP BY ot.id_proyecto
            ) g ON g.id_proyecto = p.id
            WHERE i.total IS NOT NULL OR g.total IS NOT NULL
            ORDER BY utilidad DESC
        """,
    },
    'pagos_por_metodo': {
        'titulo': 'Pagos por método (histórico)',
        'descripcion': 'Distribución histórica de los cobros según el método de pago.',
        'columnas': ['Método', 'Pagos', 'Total (Bs)'],
        'sql': """
            SELECT metodo,
                   COUNT(*) AS pagos,
                   SUM(monto) AS total
            FROM pago
            GROUP BY metodo
            ORDER BY total DESC
        """,
    },
    'top_clientes': {
        'titulo': 'Top 10 clientes por ingresos',
        'descripcion': 'Clientes que más ingresos generaron, con proyectos y total pagado.',
        'columnas': ['Cliente', 'Proyectos', 'Pagos', 'Total (Bs)'],
        'sql': """
            SELECT e.nombre AS cliente,
                   COUNT(DISTINCT pr.id) AS proyectos,
                   COUNT(pa.id) AS pagos,
                   SUM(pa.monto) AS total
            FROM pago pa
            JOIN proyecto pr ON pr.id = pa.id_proyecto
            JOIN entidad e ON e.id = pr.id_entidad
            GROUP BY e.id, e.nombre
            ORDER BY total DESC
            LIMIT 10
        """,
    },
    'cuentas_por_cobrar': {
        'titulo': 'Cuentas por cobrar (saldos pendientes)',
        'descripcion': 'Proyectos con cotización aprobada y saldo pendiente: monto cotizado, pagado y saldo.',
        'columnas': ['Proyecto', 'Cliente', 'Cotizado (Bs)', 'Pagado (Bs)', 'Saldo (Bs)'],
        'sql': """
            SELECT * FROM (
                SELECT pr.codigo AS proyecto,
                       e.nombre AS cliente,
                       COALESCE(co.subtotal_productos, 0) + COALESCE(co.mano_de_obra, 0) AS cotizado,
                       COALESCE(p.total, 0) AS pagado,
                       (COALESCE(co.subtotal_productos, 0) + COALESCE(co.mano_de_obra, 0))
                           - COALESCE(p.total, 0) AS saldo
                FROM proyecto pr
                JOIN cotizacion co
                  ON co.id = pr.id_cotizacion AND co.estado IN ('aprobada', 'convertida')
                JOIN entidad e ON e.id = pr.id_entidad
                LEFT JOIN (
                    SELECT id_proyecto, SUM(monto) AS total FROM pago GROUP BY id_proyecto
                ) p ON p.id_proyecto = pr.id
            ) t
            WHERE t.saldo > 0
            ORDER BY t.saldo DESC
        """,
    },
}


def _ejecutar_reporte_estatico(clave):
    """Reporte estático: la consulta SQL se ejecuta tal cual está escrita."""
    from sqlalchemy import text

    definicion = REPORTES_ESTATICOS[clave]
    resultado = db.session.execute(text(definicion['sql']))
    filas = [[_valor_plano(v) for v in fila] for fila in resultado.fetchall()]
    return definicion, filas


def _valor_plano(v):
    if isinstance(v, Decimal):
        return float(v)
    if isinstance(v, (date, datetime)):
        return v.isoformat()
    return v


@bp.get('/reporte/estaticos')
@jwt_required()
@requiere_permiso('ver_finanzas')
def listar_reportes_estaticos():
    return jsonify([
        {'clave': clave, 'titulo': d['titulo'], 'descripcion': d['descripcion']}
        for clave, d in REPORTES_ESTATICOS.items()
    ])


@bp.get('/reporte/estaticos/<clave>')
@jwt_required()
@requiere_permiso('ver_finanzas')
def reporte_estatico(clave):
    if clave not in REPORTES_ESTATICOS:
        return jsonify({'error': 'Reporte no encontrado'}), 404
    definicion, filas = _ejecutar_reporte_estatico(clave)
    log('VER_REPORTE_ESTATICO', f"Reporte estático '{definicion['titulo']}' consultado",
        id_usuario=int(get_jwt_identity()), modulo='finanzas')
    return jsonify({
        'clave': clave,
        'titulo': definicion['titulo'],
        'descripcion': definicion['descripcion'],
        'columnas': definicion['columnas'],
        'filas': filas,
    })


@bp.get('/reporte/estaticos/<clave>/exportar')
@jwt_required()
@requiere_permiso('ver_finanzas')
def exportar_reporte_estatico(clave):
    from ...utils.reportes import exportar_secciones_pdf, exportar_secciones_xlsx
    from ...utils.timezone import ahora_bolivia

    if clave not in REPORTES_ESTATICOS:
        return jsonify({'error': 'Reporte no encontrado'}), 404
    formato = (request.args.get('formato') or 'pdf').lower()
    if formato not in ('pdf', 'xlsx'):
        return jsonify({'error': 'Formato no soportado (use pdf o xlsx)'}), 400

    definicion, filas = _ejecutar_reporte_estatico(clave)
    if not filas:
        return jsonify({'error': 'El reporte no tiene datos'}), 404

    secciones = [{'titulo': None, 'columnas': definicion['columnas'], 'filas': filas}]
    log('EXPORTAR_REPORTE_ESTATICO',
        f"Reporte estático '{definicion['titulo']}' exportado en {formato.upper()}",
        id_usuario=int(get_jwt_identity()), modulo='finanzas')

    marca = ahora_bolivia().strftime('%Y%m%d_%H%M')
    nombre = f'reporte_{clave}_{marca}'
    titulo = f"ServiControl — {definicion['titulo']}"
    if formato == 'xlsx':
        return exportar_secciones_xlsx(titulo, [definicion['descripcion']], secciones, nombre)
    return exportar_secciones_pdf(titulo, [definicion['descripcion']], secciones, nombre)


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
