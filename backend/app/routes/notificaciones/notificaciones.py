from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from ..extensions import db
from ..models.notificacion import Notificacion

bp = Blueprint('notificaciones', __name__)


@bp.get('/')
@jwt_required()
def listar():
    id_usuario = int(get_jwt_identity())
    notifs = Notificacion.query.filter_by(id_usuario=id_usuario).order_by(Notificacion.fecha_creacion.desc()).all()
    return jsonify([_serializar(n) for n in notifs])


@bp.put('/<int:id_notificacion>/leer')
@jwt_required()
def marcar_leida(id_notificacion):
    n = db.get_or_404(Notificacion, id_notificacion)
    n.leida = True
    db.session.commit()
    return jsonify({'mensaje': 'Notificación marcada como leída'})


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
