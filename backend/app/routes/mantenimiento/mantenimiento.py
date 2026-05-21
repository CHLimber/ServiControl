from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from ..extensions import db
from ..models.mantenimiento import Mantenimiento
from ..bitacora import log
from ..permisos import requiere_permiso

bp = Blueprint('mantenimiento', __name__)

ESTADOS = ('pendiente', 'confirmado', 'reprogramado', 'completado', 'vencido')
TIPOS   = ('preventivo', 'correctivo')


@bp.get('/')
@jwt_required()
@requiere_permiso('ver_mantenimientos')
def listar():
    mantenimientos = Mantenimiento.query.order_by(Mantenimiento.fecha_programada).all()
    return jsonify([_serializar(m) for m in mantenimientos])


@bp.get('/<int:id_mantenimiento>')
@jwt_required()
@requiere_permiso('ver_mantenimientos')
def obtener(id_mantenimiento):
    m = db.get_or_404(Mantenimiento, id_mantenimiento)
    return jsonify(_serializar(m))


@bp.post('/')
@jwt_required()
@requiere_permiso('gestionar_mantenimientos')
def crear():
    data = request.get_json()
    id_usuario = int(get_jwt_identity())

    for campo in ['id_sistema', 'tipo', 'fecha_programada']:
        if not data.get(campo):
            return jsonify({'error': f'El campo {campo} es requerido'}), 400

    if data['tipo'] not in TIPOS:
        return jsonify({'error': f'Tipo inválido. Valores: {TIPOS}'}), 400

    mantenimiento = Mantenimiento(
        id_sistema=data['id_sistema'],
        id_orden_trabajo=data.get('id_orden_trabajo') or None,
        id_usuario=id_usuario,
        tipo=data['tipo'],
        fecha_programada=data['fecha_programada'],
        periodicidad_dias=data.get('periodicidad_dias') or None,
        estado=data.get('estado', 'pendiente'),
        creado_automaticamente=False,
    )
    db.session.add(mantenimiento)
    db.session.commit()
    log('CREAR_MANTENIMIENTO', f"Mantenimiento {data['tipo']} programado para sistema {data['id_sistema']}",
        id_usuario=id_usuario, modulo='mantenimiento')
    return jsonify(_serializar(mantenimiento)), 201


@bp.put('/<int:id_mantenimiento>')
@jwt_required()
@requiere_permiso('gestionar_mantenimientos')
def actualizar(id_mantenimiento):
    m = db.get_or_404(Mantenimiento, id_mantenimiento)
    data = request.get_json()
    id_usuario = int(get_jwt_identity())

    if 'estado' in data:
        if data['estado'] not in ESTADOS:
            return jsonify({'error': f'Estado inválido. Valores: {ESTADOS}'}), 400
        m.estado = data['estado']

    if 'fecha_programada' in data:
        m.fecha_programada = data['fecha_programada']
    if 'periodicidad_dias' in data:
        m.periodicidad_dias = data['periodicidad_dias'] or None
    if 'id_orden_trabajo' in data:
        m.id_orden_trabajo = data['id_orden_trabajo'] or None

    db.session.commit()
    log('ACTUALIZAR_MANTENIMIENTO', f"Mantenimiento {id_mantenimiento} → estado '{m.estado}'",
        id_usuario=id_usuario, modulo='mantenimiento')
    return jsonify(_serializar(m))


def _serializar(m: Mantenimiento) -> dict:
    return {
        'id': m.id,
        'id_sistema': m.id_sistema,
        'id_orden_trabajo': m.id_orden_trabajo,
        'tipo': m.tipo,
        'estado': m.estado,
        'fecha_programada': m.fecha_programada.isoformat() if m.fecha_programada else None,
        'periodicidad_dias': m.periodicidad_dias,
        'creado_automaticamente': m.creado_automaticamente,
        'fecha_creacion': m.fecha_creacion.isoformat() if m.fecha_creacion else None,
    }
