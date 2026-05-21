from functools import wraps
from flask import jsonify
from flask_jwt_extended import get_jwt_identity
from .extensions import db
from .models.auth import Usuario, RolPermiso, Permiso


def requiere_permiso(nombre):
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            id_usuario = int(get_jwt_identity())
            usuario = db.session.get(Usuario, id_usuario)
            if not usuario:
                return jsonify({'error': 'Usuario no encontrado'}), 401

            tiene = (
                db.session.query(RolPermiso)
                .join(Permiso, RolPermiso.id_permiso == Permiso.id)
                .filter(
                    RolPermiso.id_rol == usuario.id_rol,
                    Permiso.nombre == nombre,
                )
                .first()
            )
            if not tiene:
                return jsonify({'error': 'Acción no permitida para tu rol'}), 403

            return fn(*args, **kwargs)
        return wrapper
    return decorator
