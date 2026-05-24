from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from decimal import Decimal
from ...extensions import db
from ...models.cotizaciones.cotizacion import Cotizacion, CotizacionDetalle
from ...models.seguridad.auth import Usuario
from ...models.catalogo.producto import Producto
from ...models.entidades.entidad import Entidad
from ...models.catalogo.proveedor import Proveedor
from ...utils.bitacora import log
from ...utils.permisos import requiere_permiso

bp = Blueprint('cotizaciones', __name__)


def _get_usuario_id(identity):
    # El JWT guarda el id del usuario como string
    try:
        return int(identity)
    except (TypeError, ValueError):
        return None


@bp.get('/')
@jwt_required()
@requiere_permiso('ver_cotizaciones')
def listar():
    cotizaciones = Cotizacion.query.order_by(Cotizacion.fecha_creacion.desc()).all()
    return jsonify([_serializar(c) for c in cotizaciones])


@bp.get('/<int:id_cotizacion>')
@jwt_required()
@requiere_permiso('ver_cotizaciones')
def obtener(id_cotizacion):
    c = db.get_or_404(Cotizacion, id_cotizacion)
    return jsonify(_serializar(c, detalle=True))


@bp.post('/')
@jwt_required()
@requiere_permiso('crear_cotizaciones')
def crear():
    data = request.get_json()
    username = get_jwt_identity()

    campos = ['id_entidad', 'id_servicio', 'id_sistema', 'detalles']
    for campo in campos:
        if not data.get(campo) and data.get(campo) != 0:
            return jsonify({'error': f'El campo {campo} es requerido'}), 400

    if not isinstance(data['detalles'], list) or len(data['detalles']) == 0:
        return jsonify({'error': 'Debe incluir al menos un producto en los detalles'}), 400

    id_usuario = _get_usuario_id(username)
    if not id_usuario:
        return jsonify({'error': 'Usuario no encontrado'}), 400

    # Calcular subtotal_productos sumando los detalles
    subtotal_productos = Decimal('0')
    for d in data['detalles']:
        if not d.get('id_producto') or not d.get('id_proveedor'):
            return jsonify({'error': 'Cada detalle requiere id_producto e id_proveedor'}), 400
        try:
            cantidad = Decimal(str(d['cantidad']))
            precio   = Decimal(str(d['precio_unitario']))
        except Exception:
            return jsonify({'error': 'Cantidad y precio deben ser números válidos'}), 400
        subtotal_productos += cantidad * precio

    mano_de_obra = Decimal(str(data.get('mano_de_obra', 0)))

    # Generar código automático: COT-YYYYMM-XXXX
    from datetime import datetime
    prefijo = datetime.now().strftime('COT-%Y%m-')
    ultimo = (Cotizacion.query
              .filter(Cotizacion.codigo.like(f'{prefijo}%'))
              .order_by(Cotizacion.id.desc())
              .first())
    siguiente = 1
    if ultimo:
        try:
            siguiente = int(ultimo.codigo.split('-')[-1]) + 1
        except ValueError:
            pass
    codigo = f"{prefijo}{siguiente:04d}"

    cotizacion = Cotizacion(
        codigo=codigo,
        id_entidad=data['id_entidad'],
        id_servicio=data['id_servicio'],
        id_usuario=id_usuario,
        id_sistema=data['id_sistema'],
        estado='borrador',
        subtotal_productos=subtotal_productos,
        mano_de_obra=mano_de_obra,
        vigencia_dias=data.get('vigencia_dias', 30),
        observacion=data.get('observacion', ''),
    )
    db.session.add(cotizacion)
    db.session.flush()

    for d in data['detalles']:
        cantidad = Decimal(str(d['cantidad']))
        precio   = Decimal(str(d['precio_unitario']))
        detalle  = CotizacionDetalle(
            id_cotizacion=cotizacion.id,
            id_producto=d['id_producto'],
            id_proveedor=d['id_proveedor'],
            cantidad=cantidad,
            precio_unitario=precio,
            subtotal=cantidad * precio,
            observacion=d.get('observacion', ''),
        )
        db.session.add(detalle)

    db.session.commit()
    log('CREAR_COTIZACION', f"Cotización {codigo} creada para entidad {data['id_entidad']}", id_usuario=id_usuario, modulo='cotizaciones')
    return jsonify(_serializar(cotizacion, detalle=True)), 201


@bp.put('/<int:id_cotizacion>')
@jwt_required()
@requiere_permiso('crear_cotizaciones')
def actualizar(id_cotizacion):
    c = db.get_or_404(Cotizacion, id_cotizacion)
    data = request.get_json()
    username = get_jwt_identity()

    # Solo se puede editar si está en borrador
    if c.estado != 'borrador':
        return jsonify({'error': 'Solo se pueden editar cotizaciones en borrador'}), 400

    if 'estado' in data:
        estados_validos = ('borrador', 'enviada', 'aprobada', 'rechazada', 'vencida')
        if data['estado'] not in estados_validos:
            return jsonify({'error': 'Estado no válido'}), 400
        c.estado = data['estado']

    if 'mano_de_obra' in data:
        c.mano_de_obra = Decimal(str(data['mano_de_obra']))
    if 'vigencia_dias' in data:
        c.vigencia_dias = data['vigencia_dias']
    if 'observacion' in data:
        c.observacion = data['observacion']

    db.session.commit()
    log('ACTUALIZAR_COTIZACION', f"Cotización {c.codigo} actualizada a estado '{c.estado}'",
        id_usuario=_get_usuario_id(username), modulo='cotizaciones')
    return jsonify(_serializar(c, detalle=True))


@bp.post('/<int:id_cotizacion>/cambiar-estado')
@jwt_required()
@requiere_permiso('crear_cotizaciones')
def cambiar_estado(id_cotizacion):
    c = db.get_or_404(Cotizacion, id_cotizacion)
    data = request.get_json()
    username = get_jwt_identity()

    estados_validos = ('borrador', 'enviada', 'aprobada', 'rechazada', 'vencida', 'convertida')
    nuevo_estado = data.get('estado')
    if nuevo_estado not in estados_validos:
        return jsonify({'error': 'Estado no válido'}), 400

    c.estado = nuevo_estado
    db.session.commit()
    log('CAMBIAR_ESTADO_COTIZACION', f"Cotización {c.codigo} → {nuevo_estado}",
        id_usuario=_get_usuario_id(username), modulo='cotizaciones')
    return jsonify(_serializar(c))


@bp.post('/<int:id_cotizacion>/convertir-proyecto')
@jwt_required()
@requiere_permiso('crear_proyectos')
def convertir_proyecto(id_cotizacion):
    """CU18 — Convierte una cotización aprobada en un proyecto."""
    c = db.get_or_404(Cotizacion, id_cotizacion)
    if c.estado != 'aprobada':
        return jsonify({'error': 'Solo se pueden convertir cotizaciones aprobadas'}), 400

    data = request.get_json() or {}
    id_usuario = _get_usuario_id(get_jwt_identity())

    from ...models.proyectos.proyecto import Proyecto, ProyectoHistorial, EstadoProyecto
    from ...models.entidades.entidad import Sistema
    from datetime import datetime

    estado_inicial = EstadoProyecto.query.order_by(EstadoProyecto.orden).first()
    if not estado_inicial:
        return jsonify({'error': 'No hay estados de proyecto configurados'}), 500

    sistema = db.session.get(Sistema, c.id_sistema)
    if not sistema or not sistema.id_establecimiento:
        return jsonify({'error': 'El sistema de la cotización no tiene un establecimiento asignado. Asigná uno antes de convertir.'}), 400
    id_establecimiento = sistema.id_establecimiento

    prefijo = datetime.now().strftime('PROY-%Y%m-')
    ultimo = (Proyecto.query
              .filter(Proyecto.codigo.like(f'{prefijo}%'))
              .order_by(Proyecto.id.desc())
              .first())
    siguiente = 1
    if ultimo:
        try:
            siguiente = int(ultimo.codigo.split('-')[-1]) + 1
        except ValueError:
            pass
    codigo = f"{prefijo}{siguiente:04d}"

    titulo = (data.get('titulo') or f'Proyecto {c.codigo}').strip()

    proyecto = Proyecto(
        codigo=codigo,
        id_entidad=c.id_entidad,
        id_establecimiento=id_establecimiento,
        id_servicio=c.id_servicio,
        id_estado_proyecto=estado_inicial.id,
        id_usuario=id_usuario,
        id_cotizacion=c.id,
        id_sistema=c.id_sistema,
        titulo=titulo,
        descripcion=(data.get('descripcion') or '').strip() or None,
        fecha_inicio=data.get('fecha_inicio') or None,
        fecha_fin=data.get('fecha_fin') or None,
    )
    db.session.add(proyecto)
    db.session.flush()

    db.session.add(ProyectoHistorial(
        id_proyecto=proyecto.id,
        id_estado_anterior=None,
        id_estado_nuevo=estado_inicial.id,
        id_usuario=id_usuario,
        observacion=f'Proyecto creado desde cotización {c.codigo}',
    ))

    c.estado = 'convertida'
    db.session.commit()

    log('CONVERTIR_COTIZACION', f"Cotización {c.codigo} convertida al proyecto {codigo}",
        id_usuario=id_usuario, modulo='cotizaciones')

    return jsonify({
        'id': proyecto.id,
        'codigo': proyecto.codigo,
        'titulo': proyecto.titulo,
        'id_cotizacion': proyecto.id_cotizacion,
        'estado_nombre': estado_inicial.nombre,
    }), 201


def _serializar(c: Cotizacion, detalle: bool = False) -> dict:
    total = float((c.subtotal_productos or 0) + (c.mano_de_obra or 0))
    data = {
        'id': c.id,
        'codigo': c.codigo,
        'id_entidad': c.id_entidad,
        'id_servicio': c.id_servicio,
        'id_usuario': c.id_usuario,
        'id_sistema': c.id_sistema,
        'estado': c.estado,
        'subtotal_productos': float(c.subtotal_productos or 0),
        'mano_de_obra': float(c.mano_de_obra or 0),
        'total': total,
        'vigencia_dias': c.vigencia_dias,
        'observacion': c.observacion,
        'fecha_creacion': c.fecha_creacion.isoformat() if c.fecha_creacion else None,
    }
    if detalle:
        prod_ids = [d.id_producto for d in c.detalles]
        prov_ids = [d.id_proveedor for d in c.detalles]
        prods_map = {p.id: p.nombre for p in Producto.query.filter(Producto.id.in_(prod_ids)).all()} if prod_ids else {}
        provs_map = {p.id: p.nombre for p in Proveedor.query.filter(Proveedor.id.in_(prov_ids)).all()} if prov_ids else {}
        data['detalles'] = [
            {
                'id': d.id,
                'id_producto': d.id_producto,
                'nombre_producto': prods_map.get(d.id_producto, f'Producto #{d.id_producto}'),
                'id_proveedor': d.id_proveedor,
                'nombre_proveedor': provs_map.get(d.id_proveedor, f'Proveedor #{d.id_proveedor}'),
                'cantidad': float(d.cantidad),
                'precio_unitario': float(d.precio_unitario),
                'subtotal': float(d.subtotal),
                'observacion': d.observacion,
            }
            for d in c.detalles
        ]
    return data


@bp.put('/<int:id_cotizacion>/detalles')
@jwt_required()
@requiere_permiso('crear_cotizaciones')
def actualizar_detalles(id_cotizacion):
    """CU16 — Reemplaza todos los detalles de una cotización en borrador."""
    c = db.get_or_404(Cotizacion, id_cotizacion)
    if c.estado != 'borrador':
        return jsonify({'error': 'Solo se pueden editar cotizaciones en borrador'}), 400

    data = request.get_json()
    nuevos = data.get('detalles', [])
    username = get_jwt_identity()

    if not isinstance(nuevos, list) or len(nuevos) == 0:
        return jsonify({'error': 'Debe incluir al menos un producto'}), 400

    subtotal_productos = Decimal('0')
    for d in nuevos:
        if not d.get('id_producto') or not d.get('id_proveedor'):
            return jsonify({'error': 'Cada detalle requiere id_producto e id_proveedor'}), 400
        try:
            cantidad = Decimal(str(d['cantidad']))
            precio   = Decimal(str(d['precio_unitario']))
        except Exception:
            return jsonify({'error': 'Cantidad y precio deben ser números válidos'}), 400
        subtotal_productos += cantidad * precio

    CotizacionDetalle.query.filter_by(id_cotizacion=id_cotizacion).delete()
    for d in nuevos:
        cantidad = Decimal(str(d['cantidad']))
        precio   = Decimal(str(d['precio_unitario']))
        db.session.add(CotizacionDetalle(
            id_cotizacion=id_cotizacion,
            id_producto=d['id_producto'],
            id_proveedor=d['id_proveedor'],
            cantidad=cantidad,
            precio_unitario=precio,
            subtotal=cantidad * precio,
            observacion=d.get('observacion', ''),
        ))

    c.subtotal_productos = subtotal_productos
    db.session.commit()
    log('ACTUALIZAR_DETALLES_COTIZACION', f"Detalles de {c.codigo} actualizados",
        id_usuario=_get_usuario_id(username), modulo='cotizaciones')
    return jsonify(_serializar(c, detalle=True))
