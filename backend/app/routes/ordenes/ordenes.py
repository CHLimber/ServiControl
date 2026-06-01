from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from ...extensions import db
from ...utils.timezone import ahora_bolivia
from ...models.ordenes.orden import OrdenTrabajo, OrdenEmpleado, OrdenProducto, OrdenHistorial, EstadoOrden
from ...models.entidades.entidad import Empleado
from ...utils.bitacora import log
from ...utils.permisos import requiere_permiso

bp = Blueprint('ordenes', __name__)


@bp.get('/')
@jwt_required()
@requiere_permiso('ver_ordenes')
def listar():
    ordenes = OrdenTrabajo.query.order_by(OrdenTrabajo.id.desc()).all()
    return jsonify([_serializar(o) for o in ordenes])


@bp.get('/estados')
@jwt_required()
@requiere_permiso('ver_ordenes')
def listar_estados():
    estados = EstadoOrden.query.order_by(EstadoOrden.orden).all()
    return jsonify([{'id': e.id, 'nombre': e.nombre} for e in estados])


@bp.get('/<int:id_orden>')
@jwt_required()
@requiere_permiso('ver_ordenes')
def obtener(id_orden):
    o = db.get_or_404(OrdenTrabajo, id_orden)
    return jsonify(_serializar(o, detalle=True))


@bp.post('/')
@jwt_required()
@requiere_permiso('crear_ordenes')
def crear():
    data = request.get_json()
    id_usuario = int(get_jwt_identity())

    for campo in ['id_proyecto', 'id_servicio', 'id_estado_orden']:
        if not data.get(campo):
            return jsonify({'error': f'El campo {campo} es requerido'}), 400

    prefijo = ahora_bolivia().strftime('OT-%Y%m-')
    ultimo = (OrdenTrabajo.query
              .filter(OrdenTrabajo.codigo.like(f'{prefijo}%'))
              .order_by(OrdenTrabajo.id.desc())
              .first())
    siguiente = 1
    if ultimo:
        try:
            siguiente = int(ultimo.codigo.split('-')[-1]) + 1
        except ValueError:
            pass
    codigo = f"{prefijo}{siguiente:04d}"

    orden = OrdenTrabajo(
        codigo=codigo,
        id_proyecto=data['id_proyecto'],
        id_servicio=data['id_servicio'],
        id_estado_orden=data['id_estado_orden'],
        id_usuario=id_usuario,
        descripcion=data.get('descripcion', '').strip() or None,
        fecha_ejecucion=data.get('fecha_ejecucion') or None,
        tiempo_estimado=data.get('tiempo_estimado') or None,
        observaciones=data.get('observaciones', '').strip() or None,
    )
    db.session.add(orden)
    db.session.flush()

    for emp in data.get('empleados', []):
        if not emp.get('id_empleado'):
            continue
        oe = OrdenEmpleado(
            id_orden_trabajo=orden.id,
            id_empleado=emp['id_empleado'],
            es_responsable=emp.get('es_responsable', False),
        )
        db.session.add(oe)

    for prod in data.get('productos', []):
        if not prod.get('id_producto') or not prod.get('cantidad_asignada'):
            continue
        op = OrdenProducto(
            id_orden_trabajo=orden.id,
            id_producto=prod['id_producto'],
            cantidad_asignada=prod['cantidad_asignada'],
        )
        db.session.add(op)

    hist = OrdenHistorial(
        id_orden_trabajo=orden.id,
        id_estado_anterior=None,
        id_estado_nuevo=data['id_estado_orden'],
        id_usuario=id_usuario,
        observacion='Orden creada',
    )
    db.session.add(hist)
    db.session.commit()

    log('CREAR_ORDEN', f"Orden {codigo} creada para proyecto {data['id_proyecto']}",
        id_usuario=id_usuario, modulo='ordenes')
    return jsonify(_serializar(orden, detalle=True)), 201


@bp.put('/<int:id_orden>')
@jwt_required()
@requiere_permiso('editar_ordenes')
def actualizar(id_orden):
    o = db.get_or_404(OrdenTrabajo, id_orden)
    data = request.get_json()
    id_usuario = int(get_jwt_identity())

    campos_seguimiento = ('descripcion', 'observaciones', 'fecha_ejecucion', 'tiempo_estimado', 'id_estado_orden')
    antes = {c: getattr(o, c) for c in campos_seguimiento}

    if 'descripcion' in data:
        o.descripcion = data['descripcion'].strip() or None
    if 'observaciones' in data:
        o.observaciones = data['observaciones'].strip() or None
    if 'fecha_ejecucion' in data:
        o.fecha_ejecucion = data['fecha_ejecucion'] or None
    if 'tiempo_estimado' in data:
        o.tiempo_estimado = data['tiempo_estimado'] or None

    if 'id_estado_orden' in data and data['id_estado_orden'] != o.id_estado_orden:
        o.id_estado_orden = data['id_estado_orden']
        hist = OrdenHistorial(
            id_orden_trabajo=o.id,
            id_estado_anterior=antes['id_estado_orden'],
            id_estado_nuevo=data['id_estado_orden'],
            id_usuario=id_usuario,
            observacion=data.get('observacion_cambio', ''),
        )
        db.session.add(hist)

    db.session.commit()

    cambios = [
        {'campo': c, 'anterior': antes[c], 'nuevo': getattr(o, c)}
        for c in campos_seguimiento
        if c in data and str(antes[c] or '') != str(getattr(o, c) or '')
    ]
    log('ACTUALIZAR_ORDEN', f"Orden {id_orden} actualizada",
        id_usuario=id_usuario, modulo='ordenes', detalles=cambios or None)
    return jsonify(_serializar(o, detalle=True))


@bp.put('/<int:id_orden>/consumo')
@jwt_required()
@requiere_permiso('editar_ordenes')
def reportar_consumo(id_orden):
    """CU25 — Reportar consumo real de materiales de una OT."""
    o = db.get_or_404(OrdenTrabajo, id_orden)
    data = request.get_json()
    id_usuario = int(get_jwt_identity())

    consumos = data.get('consumos', [])
    for item in consumos:
        id_producto = item.get('id_producto')
        if not id_producto:
            continue
        op = OrdenProducto.query.filter_by(
            id_orden_trabajo=id_orden,
            id_producto=id_producto,
        ).first()
        if op is None:
            continue
        if 'cantidad_usada' in item:
            val = item['cantidad_usada']
            op.cantidad_usada = float(val) if val not in (None, '') else None
        if 'observacion' in item:
            op.observacion = (item['observacion'] or '').strip() or None

    db.session.commit()
    log('REPORTAR_CONSUMO', f"Consumo de materiales reportado en orden {o.codigo}",
        id_usuario=id_usuario, modulo='ordenes')
    return jsonify(_serializar(o, detalle=True))


@bp.put('/<int:id_orden>/empleados')
@jwt_required()
@requiere_permiso('editar_ordenes')
def actualizar_empleados(id_orden):
    """CU23 — Reemplaza el personal asignado a una OT."""
    o = db.get_or_404(OrdenTrabajo, id_orden)
    data = request.get_json()
    id_usuario = int(get_jwt_identity())

    OrdenEmpleado.query.filter_by(id_orden_trabajo=id_orden).delete()
    for emp in data.get('empleados', []):
        if not emp.get('id_empleado'):
            continue
        db.session.add(OrdenEmpleado(
            id_orden_trabajo=id_orden,
            id_empleado=emp['id_empleado'],
            es_responsable=emp.get('es_responsable', False),
        ))

    db.session.commit()
    log('ACTUALIZAR_EMPLEADOS_OT', f"Personal actualizado en orden {o.codigo}",
        id_usuario=id_usuario, modulo='ordenes')
    return jsonify(_serializar(o, detalle=True))


@bp.put('/<int:id_orden>/materiales')
@jwt_required()
@requiere_permiso('editar_ordenes')
def actualizar_materiales(id_orden):
    """CU24 — Reemplaza los materiales asignados a una OT preservando consumo ya reportado."""
    o = db.get_or_404(OrdenTrabajo, id_orden)
    data = request.get_json()
    id_usuario = int(get_jwt_identity())

    consumos_prev = {
        op.id_producto: (op.cantidad_usada, op.observacion)
        for op in o.productos
    }

    OrdenProducto.query.filter_by(id_orden_trabajo=id_orden).delete()
    for prod in data.get('productos', []):
        id_prod = prod.get('id_producto')
        cant    = prod.get('cantidad_asignada')
        if not id_prod or not cant:
            continue
        cant_usada, obs = consumos_prev.get(int(id_prod), (None, None))
        db.session.add(OrdenProducto(
            id_orden_trabajo=id_orden,
            id_producto=int(id_prod),
            cantidad_asignada=cant,
            cantidad_usada=cant_usada,
            observacion=obs,
        ))

    db.session.commit()
    log('ACTUALIZAR_MATERIALES_OT', f"Materiales actualizados en orden {o.codigo}",
        id_usuario=id_usuario, modulo='ordenes')
    return jsonify(_serializar(o, detalle=True))


def _serializar(o: OrdenTrabajo, detalle: bool = False) -> dict:
    data = {
        'id': o.id,
        'codigo': o.codigo,
        'id_proyecto': o.id_proyecto,
        'id_servicio': o.id_servicio,
        'id_estado_orden': o.id_estado_orden,
        'estado_nombre': o.estado.nombre if o.estado else None,
        'descripcion': o.descripcion,
        'fecha_ejecucion': o.fecha_ejecucion.isoformat() if o.fecha_ejecucion else None,
        'tiempo_estimado': o.tiempo_estimado,
        'observaciones': o.observaciones,
        'fecha_creacion': o.fecha_creacion.isoformat() if o.fecha_creacion else None,
    }
    if detalle:
        estados_map = {e.id: e.nombre for e in EstadoOrden.query.all()}

        from ...models.catalogo.producto import Producto
        prod_ids = [p.id_producto for p in o.productos]
        prods_map = {}
        if prod_ids:
            for prod in Producto.query.filter(Producto.id.in_(prod_ids)).all():
                prods_map[prod.id] = prod.nombre

        emp_ids = [e.id_empleado for e in o.empleados]
        emps_nombre = {}
        if emp_ids:
            for emp in Empleado.query.filter(Empleado.id.in_(emp_ids)).all():
                emps_nombre[emp.id] = (emp.entidad.nombre if emp.entidad else None) or f'Empleado #{emp.id}'
        data['empleados'] = [
            {
                'id_empleado': e.id_empleado,
                'nombre_empleado': emps_nombre.get(e.id_empleado, f'Empleado #{e.id_empleado}'),
                'es_responsable': e.es_responsable,
            }
            for e in o.empleados
        ]
        data['productos'] = [
            {
                'id_producto': p.id_producto,
                'nombre_producto': prods_map.get(p.id_producto, f'Producto #{p.id_producto}'),
                'cantidad_asignada': float(p.cantidad_asignada),
                'cantidad_usada': float(p.cantidad_usada) if p.cantidad_usada is not None else None,
                'observacion': p.observacion,
            }
            for p in o.productos
        ]
        data['historial'] = [
            {
                'id_estado_anterior': h.id_estado_anterior,
                'estado_anterior': estados_map.get(h.id_estado_anterior),
                'id_estado_nuevo': h.id_estado_nuevo,
                'estado_nuevo': estados_map.get(h.id_estado_nuevo),
                'fecha_cambio': h.fecha_cambio.isoformat() if h.fecha_cambio else None,
                'observacion': h.observacion,
            }
            for h in sorted(o.historial, key=lambda h: h.fecha_cambio or datetime.min)
        ]
    return data
