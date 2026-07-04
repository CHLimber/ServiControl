from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity

from ...extensions import db
from ...models.seguridad.auth import Usuario, Permiso, RolPermiso
from ...services.chatbot import agente
from ...services.chatbot import herramientas as H
from ...utils.bitacora import log

bp = Blueprint('chatbot', __name__)

ROL_ADMIN = 'Administrador'


def _permisos_usuario(usuario):
    nombres = [
        nombre for (nombre,) in (
            db.session.query(Permiso.nombre)
            .join(RolPermiso, RolPermiso.id_permiso == Permiso.id)
            .filter(RolPermiso.id_rol == usuario.id_rol)
            .all()
        )
    ]
    es_admin = bool(usuario.rol and usuario.rol.nombre == ROL_ADMIN)
    return nombres, es_admin


@bp.get('/modulos')
@jwt_required()
def modulos():
    """Módulos que el usuario puede consultar con el asistente (para la UI)."""
    usuario = db.session.get(Usuario, int(get_jwt_identity()))
    if not usuario:
        return jsonify({'error': 'Usuario no encontrado'}), 401
    permisos, es_admin = _permisos_usuario(usuario)
    permitidos = H.modulos_permitidos(permisos, es_admin)
    return jsonify({
        'modulos': [{'clave': m, 'nombre': H.MODULOS_LABEL[m]} for m in permitidos],
        'disponible': bool(permitidos),
    })


@bp.post('/consultar')
@jwt_required()
def consultar():
    usuario = db.session.get(Usuario, int(get_jwt_identity()))
    if not usuario:
        return jsonify({'error': 'Usuario no encontrado'}), 401

    data = request.get_json(silent=True) or {}
    pregunta = (data.get('pregunta') or '').strip()
    historial = data.get('historial') or []
    if not pregunta:
        return jsonify({'error': 'La pregunta no puede estar vacía'}), 400
    if len(pregunta) > 1000:
        return jsonify({'error': 'La pregunta es demasiado larga (máx. 1000 caracteres)'}), 400

    permisos, es_admin = _permisos_usuario(usuario)
    resultado = agente.responder(pregunta, historial, permisos, es_admin)

    if 'error' in resultado:
        return jsonify(resultado), 200  # error "de negocio", se muestra en el chat

    log('CONSULTA_CHATBOT',
        f'Consulta: "{pregunta[:120]}" | módulos: {resultado.get("modulos_consultados")}',
        id_usuario=usuario.id, modulo='chatbot')

    return jsonify(resultado)
