from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from werkzeug.security import generate_password_hash
from ..extensions import db
from ..models.auth import Usuario, Rol
from ..models.entidad import Empleado, Entidad
from ..bitacora import log
from .. import correo
from ..permisos import requiere_permiso

bp = Blueprint('usuarios', __name__)


@bp.get('/')
@jwt_required()
@requiere_permiso('gestionar_usuarios')
def listar():
    usuarios = Usuario.query.order_by(Usuario.username).all()
    return jsonify([_serializar(u) for u in usuarios])


@bp.get('/roles')
@jwt_required()
@requiere_permiso('gestionar_usuarios')
def listar_roles():
    roles = Rol.query.order_by(Rol.nombre).all()
    return jsonify([{'id': r.id, 'nombre': r.nombre} for r in roles])


@bp.get('/<int:id_usuario>')
@jwt_required()
@requiere_permiso('gestionar_usuarios')
def obtener(id_usuario):
    u = db.get_or_404(Usuario, id_usuario)
    return jsonify(_serializar(u))


@bp.post('/')
@jwt_required()
@requiere_permiso('gestionar_usuarios')
def crear():
    data = request.get_json()
    id_solicitante = get_jwt_identity()

    for campo in ['username', 'password', 'id_rol', 'id_empleado']:
        if not data.get(campo):
            return jsonify({'error': f'El campo {campo} es requerido'}), 400

    if len(data['password']) < 6:
        return jsonify({'error': 'La contraseña debe tener al menos 6 caracteres'}), 400

    if Usuario.query.filter_by(username=data['username'].strip()).first():
        return jsonify({'error': 'Ya existe un usuario con ese username'}), 409

    if not Rol.query.get(data['id_rol']):
        return jsonify({'error': 'Rol no válido'}), 400

    if not Empleado.query.filter_by(id=data['id_empleado'], estado=True).first():
        return jsonify({'error': 'Empleado no válido o inactivo'}), 400

    # Un empleado solo puede tener un usuario activo
    existente = Usuario.query.filter_by(id_empleado=data['id_empleado'], estado=True).first()
    if existente:
        return jsonify({'error': 'Ese empleado ya tiene un usuario activo'}), 409

    usuario = Usuario(
        username=data['username'].strip(),
        password=generate_password_hash(data['password']),
        id_rol=data['id_rol'],
        id_empleado=data['id_empleado'],
        email=data.get('email', '').strip() or None,
        estado=True,
        intentos_fallidos=0,
    )
    db.session.add(usuario)
    db.session.commit()
    log('CREAR_USUARIO', f"Usuario '{usuario.username}' creado", id_usuario=int(id_solicitante), modulo='usuarios')
    return jsonify(_serializar(usuario)), 201


@bp.put('/<int:id_usuario>')
@jwt_required()
@requiere_permiso('gestionar_usuarios')
def actualizar(id_usuario):
    u = db.get_or_404(Usuario, id_usuario)
    data = request.get_json()
    id_solicitante = get_jwt_identity()

    if 'username' in data:
        username_nuevo = data['username'].strip()
        existente = Usuario.query.filter_by(username=username_nuevo).first()
        if existente and existente.id != id_usuario:
            return jsonify({'error': 'Ese username ya está en uso'}), 409
        u.username = username_nuevo

    if 'email' in data:
        u.email = data['email'].strip() or None

    if 'id_rol' in data:
        if not Rol.query.get(data['id_rol']):
            return jsonify({'error': 'Rol no válido'}), 400
        u.id_rol = data['id_rol']

    cambio_password = False
    if 'password' in data and data['password']:
        if len(data['password']) < 6:
            return jsonify({'error': 'La contraseña debe tener al menos 6 caracteres'}), 400
        u.password = generate_password_hash(data['password'])
        cambio_password = True

    db.session.commit()
    log('ACTUALIZAR_USUARIO', f"Usuario '{u.username}' actualizado", id_usuario=int(id_solicitante), modulo='usuarios')
    if cambio_password:
        correo.notificar_cambio_password(u.email, u.username)
    return jsonify(_serializar(u))


@bp.patch('/<int:id_usuario>/estado')
@jwt_required()
@requiere_permiso('gestionar_usuarios')
def cambiar_estado(id_usuario):
    u = db.get_or_404(Usuario, id_usuario)
    id_solicitante = int(get_jwt_identity())

    if u.id == id_solicitante:
        return jsonify({'error': 'No podés desactivar tu propio usuario'}), 400

    u.estado = not u.estado
    db.session.commit()
    accion = 'ACTIVAR_USUARIO' if u.estado else 'DESACTIVAR_USUARIO'
    log(accion, f"Usuario '{u.username}' {'activado' if u.estado else 'desactivado'}", id_usuario=id_solicitante, modulo='usuarios')
    return jsonify(_serializar(u))


@bp.patch('/<int:id_usuario>/desbloquear')
@jwt_required()
@requiere_permiso('gestionar_usuarios')
def desbloquear(id_usuario):
    u = db.get_or_404(Usuario, id_usuario)
    id_solicitante = get_jwt_identity()
    u.intentos_fallidos = 0
    u.bloqueado_hasta = None
    u.veces_bloqueado = 0
    db.session.commit()
    log('DESBLOQUEAR_USUARIO', f"Usuario '{u.username}' desbloqueado manualmente", id_usuario=int(id_solicitante), modulo='usuarios')
    correo.notificar_cuenta_desbloqueada(u.email, u.username)
    return jsonify(_serializar(u))


def _serializar(u: Usuario) -> dict:
    nombre_empleado = None
    if u.empleado and u.empleado.entidad:
        nombre_empleado = u.empleado.entidad.nombre

    return {
        'id': u.id,
        'username': u.username,
        'email': u.email,
        'id_rol': u.id_rol,
        'rol_nombre': u.rol.nombre if u.rol else None,
        'id_empleado': u.id_empleado,
        'empleado_nombre': nombre_empleado,
        'estado': u.estado,
        'ultimo_acceso': u.ultimo_acceso.isoformat() if u.ultimo_acceso else None,
        'ultima_salida': u.ultima_salida.isoformat() if u.ultima_salida else None,
        'fecha_creacion': u.fecha_creacion.isoformat() if u.fecha_creacion else None,
        'bloqueado': u.bloqueado_hasta is not None and u.bloqueado_hasta > __import__('datetime').datetime.now(),
        'intentos_fallidos': u.intentos_fallidos,
        'veces_bloqueado': u.veces_bloqueado,
    }
