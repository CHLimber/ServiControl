from flask import Blueprint, jsonify, abort
from flask_jwt_extended import jwt_required, get_jwt_identity
from ...extensions import db
from ...models.notificaciones.notificacion import Notificacion

bp = Blueprint('notificaciones', __name__)


@bp.get('/')
@jwt_required()
def listar():
    id_usuario = int(get_jwt_identity())
    notifs = Notificacion.query.filter_by(id_usuario=id_usuario).order_by(Notificacion.fecha_creacion.desc()).all()
    return jsonify([_serializar(n) for n in notifs])


@bp.get('/no-leidas')
@jwt_required()
def no_leidas():
    id_usuario = int(get_jwt_identity())
    notifs = (Notificacion.query
              .filter_by(id_usuario=id_usuario, leida=False)
              .order_by(Notificacion.fecha_creacion.desc())
              .all())
    return jsonify([_serializar(n) for n in notifs])


@bp.put('/leer-todas')
@jwt_required()
def marcar_todas_leidas():
    id_usuario = int(get_jwt_identity())
    Notificacion.query.filter_by(id_usuario=id_usuario, leida=False).update({'leida': True})
    db.session.commit()
    return jsonify({'mensaje': 'Todas las notificaciones marcadas como leídas'})


@bp.put('/<int:id_notificacion>/leer')
@jwt_required()
def marcar_leida(id_notificacion):
    id_usuario = int(get_jwt_identity())
    n = db.get_or_404(Notificacion, id_notificacion)
    if n.id_usuario != id_usuario:
        abort(403)
    n.leida = True
    db.session.commit()
    return jsonify({'mensaje': 'Notificación marcada como leída'})


@bp.delete('/<int:id_notificacion>')
@jwt_required()
def eliminar(id_notificacion):
    id_usuario = int(get_jwt_identity())
    n = db.get_or_404(Notificacion, id_notificacion)
    if n.id_usuario != id_usuario:
        abort(403)
    db.session.delete(n)
    db.session.commit()
    return jsonify({'mensaje': 'Notificación eliminada'})


def _serializar(n: Notificacion) -> dict:
    return {
        'id': n.id,
        'tipo': n.tipo,
        'titulo': n.titulo,
        'mensaje': n.mensaje,
        'leida': n.leida,
        'fecha_creacion': n.fecha_creacion.isoformat() if n.fecha_creacion else None,
        'url': n.url,
    }
