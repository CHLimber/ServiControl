from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from ...extensions import db
from ...models.catalogo.catalogo import Servicio
from ...utils.bitacora import log
from ...utils.permisos import requiere_permiso

bp = Blueprint('servicios', __name__)


def _serializar(s: Servicio) -> dict:
    return {
        'id': s.id,
        'nombre': s.nombre,
        'descripcion': s.descripcion,
        'precio': float(s.precio),
        'estado': s.estado,
    }


@bp.get('/')
@jwt_required()
@requiere_permiso('gestionar_catalogo')
def listar():
    todos = request.args.get('todos') == '1'
    q = Servicio.query
    if not todos:
        q = q.filter_by(estado=True)
    return jsonify([_serializar(s) for s in q.order_by(Servicio.nombre).all()])


@bp.get('/<int:id_servicio>')
@jwt_required()
@requiere_permiso('gestionar_catalogo')
def obtener(id_servicio):
    s = db.get_or_404(Servicio, id_servicio)
    return jsonify(_serializar(s))


@bp.post('/')
@jwt_required()
@requiere_permiso('gestionar_catalogo')
def crear():
    data = request.get_json()
    usuario = get_jwt_identity()

    nombre = (data.get('nombre') or '').strip()
    if not nombre:
        return jsonify({'error': 'El nombre del servicio es requerido'}), 400

    try:
        precio = float(data.get('precio', 0))
        if precio <= 0:
            raise ValueError
    except (TypeError, ValueError):
        return jsonify({'error': 'El precio debe ser un número mayor a cero'}), 400

    if Servicio.query.filter(
        db.func.lower(Servicio.nombre) == nombre.lower()
    ).first():
        return jsonify({'error': 'Ya existe un servicio con ese nombre'}), 409

    servicio = Servicio(
        nombre=nombre,
        descripcion=(data.get('descripcion') or '').strip() or None,
        precio=precio,
    )
    db.session.add(servicio)
    db.session.commit()

    log('CREAR_SERVICIO', f"Servicio '{servicio.nombre}' creado (Bs {precio:.2f})",
        id_usuario=int(usuario), modulo='servicios')
    return jsonify(_serializar(servicio)), 201


@bp.put('/<int:id_servicio>')
@jwt_required()
@requiere_permiso('gestionar_catalogo')
def actualizar(id_servicio):
    s = db.get_or_404(Servicio, id_servicio)
    data = request.get_json()
    usuario = get_jwt_identity()

    if 'nombre' in data:
        nombre = (data['nombre'] or '').strip()
        if not nombre:
            return jsonify({'error': 'El nombre no puede estar vacío'}), 400
        existente = Servicio.query.filter(
            db.func.lower(Servicio.nombre) == nombre.lower(),
            Servicio.id != id_servicio,
        ).first()
        if existente:
            return jsonify({'error': 'Ya existe un servicio con ese nombre'}), 409
        s.nombre = nombre

    if 'descripcion' in data:
        s.descripcion = (data['descripcion'] or '').strip() or None

    if 'precio' in data:
        try:
            precio = float(data['precio'])
            if precio <= 0:
                raise ValueError
        except (TypeError, ValueError):
            return jsonify({'error': 'El precio debe ser un número mayor a cero'}), 400
        s.precio = precio

    db.session.commit()
    log('ACTUALIZAR_SERVICIO', f"Servicio {id_servicio} '{s.nombre}' actualizado",
        id_usuario=int(usuario), modulo='servicios')
    return jsonify(_serializar(s))


@bp.delete('/<int:id_servicio>')
@jwt_required()
@requiere_permiso('gestionar_catalogo')
def desactivar(id_servicio):
    s = db.get_or_404(Servicio, id_servicio)
    s.estado = False
    db.session.commit()
    log('DESACTIVAR_SERVICIO', f"Servicio {id_servicio} '{s.nombre}' desactivado",
        id_usuario=int(get_jwt_identity()), modulo='servicios')
    return jsonify({'mensaje': 'Servicio desactivado'})
