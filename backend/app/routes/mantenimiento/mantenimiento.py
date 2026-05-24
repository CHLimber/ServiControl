from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from ...extensions import db
from ...models.mantenimiento.mantenimiento import Mantenimiento, AlertaMantenimiento
from ...models.entidades.entidad import Sistema, Establecimiento, Entidad
from ...models.seguridad.auth import Usuario
from ...utils.bitacora import log
from ...utils.permisos import requiere_permiso

bp = Blueprint('mantenimiento', __name__)

ESTADOS        = ('pendiente', 'confirmado', 'reprogramado', 'completado', 'vencido')
TIPOS          = ('preventivo', 'correctivo')
ESTADOS_ALERTA = ('pendiente', 'enviada', 'leida', 'completada')


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


@bp.get('/alertas')
@jwt_required()
@requiere_permiso('ver_mantenimientos')
def listar_alertas():
    estado            = request.args.get('estado')
    id_establecimiento = request.args.get('id_establecimiento', type=int)

    q = AlertaMantenimiento.query
    if estado:
        q = q.filter(AlertaMantenimiento.estado == estado)
    if id_establecimiento:
        q = q.filter(AlertaMantenimiento.id_establecimiento == id_establecimiento)

    alertas = q.order_by(AlertaMantenimiento.fecha.desc()).all()
    return jsonify([_serializar_alerta(a) for a in alertas])


@bp.post('/alertas')
@jwt_required()
@requiere_permiso('gestionar_mantenimientos')
def crear_alerta():
    data       = request.get_json()
    id_usuario = int(get_jwt_identity())

    for campo in ['id_mantenimiento', 'id_establecimiento']:
        if not data.get(campo):
            return jsonify({'error': f'El campo {campo} es requerido'}), 400

    alerta = AlertaMantenimiento(
        id_mantenimiento   = data['id_mantenimiento'],
        id_usuario         = id_usuario,
        id_establecimiento = data['id_establecimiento'],
        estado             = data.get('estado', 'pendiente'),
        observacion        = data.get('observacion') or None,
    )
    db.session.add(alerta)
    db.session.commit()
    log('CREAR_ALERTA_MANTENIMIENTO', f"Alerta creada para mantenimiento {data['id_mantenimiento']}",
        id_usuario=id_usuario, modulo='mantenimiento')
    return jsonify(_serializar_alerta(alerta)), 201


@bp.put('/alertas/<int:id_alerta>')
@jwt_required()
@requiere_permiso('gestionar_mantenimientos')
def actualizar_alerta(id_alerta):
    a          = db.get_or_404(AlertaMantenimiento, id_alerta)
    data       = request.get_json()
    id_usuario = int(get_jwt_identity())

    if 'estado' in data:
        if data['estado'] not in ESTADOS_ALERTA:
            return jsonify({'error': f'Estado inválido. Valores: {ESTADOS_ALERTA}'}), 400
        a.estado = data['estado']
    if 'observacion' in data:
        a.observacion = data['observacion'] or None

    db.session.commit()
    log('ACTUALIZAR_ALERTA_MANTENIMIENTO', f"Alerta {id_alerta} → estado '{a.estado}'",
        id_usuario=id_usuario, modulo='mantenimiento')
    return jsonify(_serializar_alerta(a))


def _serializar_alerta(a: AlertaMantenimiento) -> dict:
    mant         = a.mantenimiento
    sistema_nombre = None
    id_sistema   = None
    if mant:
        id_sistema = mant.id_sistema
        sis = db.session.get(Sistema, mant.id_sistema)
        sistema_nombre = sis.nombre if sis else f'Sistema #{mant.id_sistema}'

    estab_nombre = f'Establecimiento #{a.id_establecimiento}'
    if a.id_establecimiento:
        estab = db.session.get(Establecimiento, a.id_establecimiento)
        if estab and estab.id_entidad:
            ent = db.session.get(Entidad, estab.id_entidad)
            if ent:
                estab_nombre = ent.nombre

    usuario_nombre = None
    if a.id_usuario:
        usu = db.session.get(Usuario, a.id_usuario)
        if usu:
            usuario_nombre = usu.username

    return {
        'id':                           a.id,
        'id_mantenimiento':             a.id_mantenimiento,
        'id_usuario':                   a.id_usuario,
        'id_establecimiento':           a.id_establecimiento,
        'fecha':                        a.fecha.isoformat() if a.fecha else None,
        'estado':                       a.estado,
        'observacion':                  a.observacion,
        'mantenimiento_tipo':           mant.tipo if mant else None,
        'mantenimiento_estado':         mant.estado if mant else None,
        'mantenimiento_fecha_programada': mant.fecha_programada.isoformat() if mant and mant.fecha_programada else None,
        'id_sistema':                   id_sistema,
        'sistema_nombre':               sistema_nombre,
        'establecimiento_nombre':       estab_nombre,
        'usuario_nombre':               usuario_nombre,
    }


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
