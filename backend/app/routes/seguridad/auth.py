from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import (
    create_access_token, create_refresh_token,
    jwt_required, get_jwt_identity,
)
from datetime import timedelta
from werkzeug.security import check_password_hash, generate_password_hash
from ...extensions import db
from ...models.seguridad.auth import Usuario, Permiso, RolPermiso
from ...utils.bitacora import log
from ...utils import correo
from ...utils.timezone import ahora_bolivia

bp = Blueprint('auth', __name__)


def _permisos_de(usuario: Usuario) -> list[str]:
    rows = (
        db.session.query(Permiso.nombre)
        .join(RolPermiso, RolPermiso.id_permiso == Permiso.id)
        .filter(RolPermiso.id_rol == usuario.id_rol)
        .all()
    )
    return [r[0] for r in rows]


def _minutos_bloqueo(veces_bloqueado: int) -> int:
    tiempos = current_app.config['LOGIN_TIEMPOS_BLOQUEO']
    idx = min(veces_bloqueado - 1, len(tiempos) - 1)
    return tiempos[idx]


@bp.post('/login')
def login():
    data = request.get_json()
    username = data.get('username', '').strip()
    password = data.get('password', '')

    max_intentos = current_app.config['LOGIN_MAX_INTENTOS']

    usuario = Usuario.query.filter_by(username=username, estado=True).first()

    if not usuario:
        log('LOGIN_FALLIDO', f"Intento con usuario inexistente '{username}'", usuario=username, modulo='auth')
        return jsonify({'error': 'Credenciales inválidas'}), 401

    if usuario.bloqueado_hasta and ahora_bolivia() < usuario.bloqueado_hasta:
        segundos_restantes = int((usuario.bloqueado_hasta - ahora_bolivia()).total_seconds())
        minutos = segundos_restantes // 60
        segundos = segundos_restantes % 60
        log('LOGIN_BLOQUEADO', f"Usuario '{username}' bloqueado — {segundos_restantes}s restantes",
            usuario=username, id_usuario=usuario.id, modulo='auth')
        return jsonify({
            'error': f'Cuenta bloqueada. Intente en {minutos}m {segundos}s.',
            'bloqueado_hasta': usuario.bloqueado_hasta.isoformat(),
        }), 423

    if not check_password_hash(usuario.password, password):
        usuario.intentos_fallidos += 1

        if usuario.intentos_fallidos >= max_intentos:
            usuario.veces_bloqueado += 1
            minutos = _minutos_bloqueo(usuario.veces_bloqueado)
            usuario.bloqueado_hasta = ahora_bolivia() + timedelta(minutes=minutos)
            db.session.commit()
            log('LOGIN_BLOQUEADO', f"Usuario '{username}' bloqueado {minutos}min (bloqueo #{usuario.veces_bloqueado})",
            usuario=username, id_usuario=usuario.id, modulo='auth')
            correo.notificar_cuenta_bloqueada(usuario.email, username, minutos, id_usuario=usuario.id)
            return jsonify({
                'error': f'Cuenta bloqueada por {minutos} minuto(s) tras {max_intentos} intentos fallidos.',
                'bloqueado_hasta': usuario.bloqueado_hasta.isoformat(),
            }), 423

        restantes = max_intentos - usuario.intentos_fallidos
        db.session.commit()
        log('LOGIN_FALLIDO', f"Contraseña incorrecta para '{username}' — intento {usuario.intentos_fallidos}/{max_intentos}",
            usuario=username, id_usuario=usuario.id, modulo='auth')
        correo.notificar_intento_fallido(usuario.email, username, usuario.intentos_fallidos, restantes, id_usuario=usuario.id)
        return jsonify({'error': f'Credenciales inválidas. Intentos restantes: {restantes}.'}), 401

    usuario.intentos_fallidos = 0
    usuario.veces_bloqueado = 0
    usuario.bloqueado_hasta = None
    usuario.ultimo_acceso = ahora_bolivia()
    db.session.commit()

    identity = str(usuario.id)
    access_token = create_access_token(identity=identity)
    refresh_token = create_refresh_token(identity=identity)
    log('LOGIN', f"Usuario '{username}' inició sesión", usuario=username, id_usuario=usuario.id, modulo='auth')

    return jsonify({
        'access_token': access_token,
        'refresh_token': refresh_token,
        'usuario': {
            'id': usuario.id,
            'username': usuario.username,
            'rol': usuario.rol.nombre,
            'permisos': _permisos_de(usuario),
        }
    })


@bp.post('/refresh')
@jwt_required(refresh=True)
def refresh():
    identity = get_jwt_identity()
    new_token = create_access_token(identity=identity)
    return jsonify({'access_token': new_token})


@bp.post('/logout')
@jwt_required()
def logout():
    id_usuario = int(get_jwt_identity())
    usuario = db.get_or_404(Usuario, id_usuario)
    usuario.ultima_salida = ahora_bolivia()
    db.session.commit()
    log('LOGOUT', f"Usuario '{usuario.username}' cerró sesión", usuario=usuario.username, id_usuario=usuario.id, modulo='auth')
    return jsonify({'mensaje': 'Sesión cerrada'}), 200


@bp.get('/me')
@jwt_required()
def me():
    id_usuario = int(get_jwt_identity())
    usuario = db.get_or_404(Usuario, id_usuario)
    return jsonify({
        'id': usuario.id,
        'username': usuario.username,
        'rol': usuario.rol.nombre,
        'permisos': _permisos_de(usuario),
    })


@bp.get('/perfil')
@jwt_required()
def get_perfil():
    id_usuario = int(get_jwt_identity())
    usuario = db.get_or_404(Usuario, id_usuario)
    nombre = ''
    if usuario.empleado and usuario.empleado.entidad:
        nombre = usuario.empleado.entidad.nombre
    return jsonify({
        'id': usuario.id,
        'username': usuario.username,
        'email': usuario.email or '',
        'nombre': nombre,
        'rol': usuario.rol.nombre,
        'ultimo_acceso': usuario.ultimo_acceso.isoformat() if usuario.ultimo_acceso else None,
        'fecha_creacion': usuario.fecha_creacion.isoformat() if usuario.fecha_creacion else None,
    })


@bp.put('/perfil')
@jwt_required()
def update_perfil():
    id_usuario = int(get_jwt_identity())
    usuario = db.get_or_404(Usuario, id_usuario)
    data = request.get_json()

    cambios = []
    if 'email' in data and data['email'] != usuario.email:
        nuevo_email = data['email'].strip()
        usuario.email = nuevo_email
        if usuario.empleado and usuario.empleado.entidad:
            usuario.empleado.entidad.email = nuevo_email
        cambios.append('email')

    if data.get('password'):
        if len(data['password']) < 8:
            return jsonify({'error': 'La contraseña debe tener al menos 8 caracteres'}), 422
        usuario.password = generate_password_hash(data['password'])
        cambios.append('password')

    if not cambios:
        return jsonify({'mensaje': 'Sin cambios'}), 200

    db.session.commit()
    log('ACTUALIZAR_PERFIL',
        f"Usuario '{usuario.username}' actualizó su perfil ({', '.join(cambios)})",
        usuario=usuario.username, id_usuario=usuario.id, modulo='auth')

    if 'password' in cambios:
        correo.notificar_cambio_password(usuario.email, usuario.username, id_usuario=usuario.id)

    return jsonify({'mensaje': 'Perfil actualizado correctamente'})
