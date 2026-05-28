from datetime import date, datetime, timedelta
from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required
from sqlalchemy import func, case

from ...extensions import db
from ...models.proyectos.proyecto import Proyecto, EstadoProyecto
from ...models.ordenes.orden import OrdenTrabajo, OrdenEmpleado, EstadoOrden
from ...models.cotizaciones.cotizacion import Cotizacion
from ...models.mantenimiento.mantenimiento import Mantenimiento
from ...models.finanzas.finanzas import Pago
from ...models.entidades.entidad import Entidad, Empleado

bp = Blueprint('dashboard', __name__)


# Estados que cuentan como finalizados (no "activos")
ESTADOS_PROY_FINALIZADOS = {'Completado', 'En Garantía', 'En Garantia', 'Cerrado', 'Cancelado'}
ESTADOS_OT_FINALIZADOS   = {'Completada', 'Validada', 'Cancelada'}

# Avance por estado de proyecto (heurístico, no hay columna `avance` en BD)
AVANCE_POR_ESTADO = {
    'Levantamiento': 5,
    'Cotizado':      15,
    'Aprobado':      25,
    'En Ejecución':  60,
    'En Ejecucion':  60,
    'Detenido':      60,
    'Bloqueado':     50,
    'Completado':    100,
    'En Garantía':   100,
    'En Garantia':   100,
    'Cerrado':       100,
    'Cancelado':     0,
}


def _inicio_mes(fecha: date) -> date:
    return fecha.replace(day=1)


def _inicio_mes_anterior(fecha: date) -> date:
    primero = _inicio_mes(fecha)
    mes_ant = primero - timedelta(days=1)
    return mes_ant.replace(day=1)


def _prioridad_ot(o: OrdenTrabajo) -> str:
    """Calcula prioridad visual a partir de la fecha de ejecución."""
    if not o.fecha_ejecucion:
        return 'media'
    hoy = date.today()
    dias = (o.fecha_ejecucion - hoy).days
    if dias < 0:
        return 'urgente'
    if dias <= 2:
        return 'alta'
    if dias <= 7:
        return 'media'
    return 'baja'


@bp.get('/')
@jwt_required()
def resumen():
    hoy = date.today()
    inicio_mes = _inicio_mes(hoy)
    inicio_mes_ant = _inicio_mes_anterior(hoy)
    fin_semana = hoy + timedelta(days=7)

    # ── Proyectos ───────────────────────────────────────────────────
    estados_proy = {e.id: e.nombre for e in EstadoProyecto.query.all()}
    ids_finalizados_proy = [eid for eid, n in estados_proy.items() if n in ESTADOS_PROY_FINALIZADOS]

    proyectos_activos = (
        Proyecto.query
        .filter(~Proyecto.id_estado_proyecto.in_(ids_finalizados_proy or [-1]))
        .count()
    )
    proyectos_nuevos_mes = (
        Proyecto.query
        .filter(Proyecto.fecha_creacion >= inicio_mes)
        .count()
    )

    # ── Órdenes de trabajo ──────────────────────────────────────────
    estados_ot = {e.id: e.nombre for e in EstadoOrden.query.all()}
    ids_finalizados_ot = [eid for eid, n in estados_ot.items() if n in ESTADOS_OT_FINALIZADOS]

    ot_pendientes = (
        OrdenTrabajo.query
        .filter(~OrdenTrabajo.id_estado_orden.in_(ids_finalizados_ot or [-1]))
        .count()
    )
    ot_vencidas = (
        OrdenTrabajo.query
        .filter(
            OrdenTrabajo.fecha_ejecucion < hoy,
            ~OrdenTrabajo.id_estado_orden.in_(ids_finalizados_ot or [-1]),
        )
        .count()
    )

    # ── Cotizaciones ────────────────────────────────────────────────
    cotizaciones_espera = (
        Cotizacion.query
        .filter(Cotizacion.estado.in_(['borrador', 'enviada']))
        .count()
    )
    cotizaciones_nuevas_hoy = (
        Cotizacion.query
        .filter(func.date(Cotizacion.fecha_creacion) == hoy)
        .count()
    )

    # ── Mantenimientos próximos ─────────────────────────────────────
    mantenimientos_proximos = (
        Mantenimiento.query
        .filter(
            Mantenimiento.estado.in_(['pendiente', 'confirmado', 'reprogramado']),
            Mantenimiento.fecha_programada >= hoy,
            Mantenimiento.fecha_programada <= fin_semana,
        )
        .count()
    )

    # ── Finanzas: cobrado este mes y mes anterior ───────────────────
    cobrado_mes = db.session.query(func.coalesce(func.sum(Pago.monto), 0)).filter(
        Pago.fecha_pago >= inicio_mes,
        Pago.fecha_pago <= hoy,
    ).scalar() or 0
    cobrado_mes_ant = db.session.query(func.coalesce(func.sum(Pago.monto), 0)).filter(
        Pago.fecha_pago >= inicio_mes_ant,
        Pago.fecha_pago < inicio_mes,
    ).scalar() or 0
    cobrado_mes = float(cobrado_mes)
    cobrado_mes_ant = float(cobrado_mes_ant)
    if cobrado_mes_ant > 0:
        delta_pct = round((cobrado_mes - cobrado_mes_ant) / cobrado_mes_ant * 100)
    else:
        delta_pct = 100 if cobrado_mes > 0 else 0

    # ── Clientes ────────────────────────────────────────────────────
    clientes_total = Entidad.query.filter_by(cliente=True, estado=True).count()
    clientes_nuevos_mes = (
        Entidad.query
        .filter(
            Entidad.cliente.is_(True),
            Entidad.fecha_registro >= inicio_mes,
        )
        .count()
    )

    # ── Listado: proyectos recientes ────────────────────────────────
    proy_recientes_q = (
        Proyecto.query
        .order_by(Proyecto.fecha_creacion.desc())
        .limit(5)
        .all()
    )
    # Mapas para nombres de cliente y montos
    ids_entidad = [p.id_entidad for p in proy_recientes_q]
    ids_cotizacion = [p.id_cotizacion for p in proy_recientes_q if p.id_cotizacion]

    nombres_entidad = {}
    if ids_entidad:
        for ent in Entidad.query.filter(Entidad.id.in_(ids_entidad)).all():
            nombres_entidad[ent.id] = ent.nombre

    montos_cotizacion = {}
    if ids_cotizacion:
        cots = Cotizacion.query.filter(Cotizacion.id.in_(ids_cotizacion)).all()
        for c in cots:
            montos_cotizacion[c.id] = float((c.subtotal_productos or 0) + (c.mano_de_obra or 0))

    # Si no hay cotización, intentar suma de pagos del proyecto como referencia
    montos_pagos = {}
    if proy_recientes_q:
        ids_proy = [p.id for p in proy_recientes_q]
        rows = (
            db.session.query(Pago.id_proyecto, func.coalesce(func.sum(Pago.monto), 0))
            .filter(Pago.id_proyecto.in_(ids_proy))
            .group_by(Pago.id_proyecto)
            .all()
        )
        for id_proy, total in rows:
            montos_pagos[id_proy] = float(total)

    proyectos_recientes = []
    for p in proy_recientes_q:
        estado_nombre = estados_proy.get(p.id_estado_proyecto) or '—'
        monto = montos_cotizacion.get(p.id_cotizacion) if p.id_cotizacion else None
        if monto is None:
            monto = montos_pagos.get(p.id, 0)
        proyectos_recientes.append({
            'id': p.id,
            'codigo': p.codigo,
            'nombre': p.titulo,
            'cliente': nombres_entidad.get(p.id_entidad, '—'),
            'estado': estado_nombre,
            'monto': monto,
            'avance': AVANCE_POR_ESTADO.get(estado_nombre, 0),
        })

    # ── Listado: OT recientes ───────────────────────────────────────
    ot_recientes_q = (
        OrdenTrabajo.query
        .order_by(OrdenTrabajo.fecha_creacion.desc())
        .limit(5)
        .all()
    )

    # Mapear técnico responsable de cada OT
    ids_ot = [o.id for o in ot_recientes_q]
    responsables_por_ot = {}
    if ids_ot:
        oe_rows = (
            OrdenEmpleado.query
            .filter(OrdenEmpleado.id_orden_trabajo.in_(ids_ot))
            .all()
        )
        # Priorizar el marcado como responsable; si no hay, tomar el primero
        for row in oe_rows:
            if row.id_orden_trabajo in responsables_por_ot and not row.es_responsable:
                continue
            responsables_por_ot[row.id_orden_trabajo] = row.id_empleado

        ids_emp = list({v for v in responsables_por_ot.values()})
        nombres_emp = {}
        if ids_emp:
            for emp in Empleado.query.filter(Empleado.id.in_(ids_emp)).all():
                nombres_emp[emp.id] = (emp.entidad.nombre if emp.entidad else f'Empleado #{emp.id}')
        responsables_por_ot = {
            id_ot: nombres_emp.get(id_emp, '—')
            for id_ot, id_emp in responsables_por_ot.items()
        }

    ordenes_recientes = []
    for o in ot_recientes_q:
        ordenes_recientes.append({
            'id': o.id,
            'codigo': o.codigo,
            'titulo': (o.descripcion or '').strip().split('\n', 1)[0] or f'OT {o.codigo}',
            'tecnico': responsables_por_ot.get(o.id, 'Sin asignar'),
            'prioridad': _prioridad_ot(o),
            'estado': estados_ot.get(o.id_estado_orden) or '—',
        })

    return jsonify({
        'stats': {
            'proyectos_activos':       proyectos_activos,
            'proyectos_nuevos_mes':    proyectos_nuevos_mes,
            'ot_pendientes':           ot_pendientes,
            'ot_vencidas':             ot_vencidas,
            'cotizaciones_espera':     cotizaciones_espera,
            'cotizaciones_nuevas_hoy': cotizaciones_nuevas_hoy,
            'mantenimientos_proximos': mantenimientos_proximos,
            'cobrado_mes':             cobrado_mes,
            'cobrado_mes_anterior':    cobrado_mes_ant,
            'cobrado_delta_pct':       delta_pct,
            'clientes_total':          clientes_total,
            'clientes_nuevos_mes':     clientes_nuevos_mes,
        },
        'proyectos_recientes': proyectos_recientes,
        'ordenes_recientes':   ordenes_recientes,
    })
