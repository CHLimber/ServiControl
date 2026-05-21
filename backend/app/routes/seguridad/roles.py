from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from ..extensions import db
from ..models.auth import Rol, Permiso, RolPermiso
from ..bitacora import log
from ..permisos import requiere_permiso

bp = Blueprint('roles', __name__)

ROL_ADMIN = 'Administrador'


@bp.get('/')
@jwt_required()
@requiere_permiso('gestionar_roles')
def listar():
    roles = Rol.query.order_by(Rol.nombre).all()
    return jsonify([_serializar_rol(r) for r in roles])


@bp.get('/permisos')
@jwt_required()
@requiere_permiso('gestionar_roles')
def listar_permisos():
    permisos = Permiso.query.order_by(Permiso.nombre).all()
    return jsonify([{'id': p.id, 'nombre': p.nombre, 'descripcion': p.descripcion} for p in permisos])


@bp.get('/<int:id_rol>')
@jwt_required()
@requiere_permiso('gestionar_roles')
def obtener(id_rol):
    rol = db.get_or_404(Rol, id_rol)
    asignados = [rp.id_permiso for rp in RolPermiso.query.filter_by(id_rol=id_rol).all()]
    data = _serializar_rol(rol)
    data['permisos_asignados'] = asignados
    return jsonify(data)


@bp.put('/<int:id_rol>/permisos')
@jwt_required()
@requiere_permiso('gestionar_roles')
def actualizar_permisos(id_rol):
    rol = db.get_or_404(Rol, id_rol)
    data = request.get_json()
    id_solicitante = int(get_jwt_identity())

    ids_nuevos = data.get('permisos', [])
    forzar = data.get('forzar', False)

    # E2: validar que todos los IDs existen en el catálogo
    if ids_nuevos:
        ids_validos = {p.id for p in Permiso.query.filter(Permiso.id.in_(ids_nuevos)).all()}
        invalidos = [i for i in ids_nuevos if i not in ids_validos]
        if invalidos:
            return jsonify({'error': f'Permisos inexistentes en el catálogo: {invalidos}'}), 400

    # E1: advertir si se quitan todos los permisos al Administrador
    if rol.nombre == ROL_ADMIN and len(ids_nuevos) == 0 and not forzar:
        return jsonify({
            'error': 'Estás a punto de quitar TODOS los permisos al rol Administrador. '
                     'Esto dejará sin acceso al sistema a todos sus usuarios. '
                     'Confirmá la acción enviando "forzar": true.',
            'advertencia': True,
        }), 409

    # Obtener permisos anteriores para bitácora
    anteriores = [rp.id_permiso for rp in RolPermiso.query.filter_by(id_rol=id_rol).all()]

    # Reemplazar permisos
    RolPermiso.query.filter_by(id_rol=id_rol).delete()
    for id_permiso in ids_nuevos:
        db.session.add(RolPermiso(id_rol=id_rol, id_permiso=id_permiso))
    db.session.flush()

    agregados = sorted(set(ids_nuevos) - set(anteriores))
    quitados  = sorted(set(anteriores) - set(ids_nuevos))

    detalles = []
    if agregados:
        detalles.append({'campo': 'permisos_agregados', 'anterior': None, 'nuevo': str(agregados)})
    if quitados:
        detalles.append({'campo': 'permisos_quitados', 'anterior': str(quitados), 'nuevo': None})

    db.session.commit()

    log(
        'ACTUALIZAR_PERMISOS_ROL',
        f"Permisos del rol '{rol.nombre}' actualizados: +{agregados} -{quitados}",
        id_usuario=id_solicitante,
        modulo='roles',
        detalles=detalles,
    )

    asignados = [rp.id_permiso for rp in RolPermiso.query.filter_by(id_rol=id_rol).all()]
    result = _serializar_rol(rol)
    result['permisos_asignados'] = asignados
    return jsonify(result)


def _serializar_rol(rol: Rol) -> dict:
    total = RolPermiso.query.filter_by(id_rol=rol.id).count()
    return {
        'id': rol.id,
        'nombre': rol.nombre,
        'descripcion': rol.descripcion,
        'total_permisos': total,
    }
