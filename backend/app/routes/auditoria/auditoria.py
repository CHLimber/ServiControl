from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from ..extensions import db
from ..models.auditoria import Bitacora, BitacoraDetalle
from ..models.auth import Usuario
from ..permisos import requiere_permiso

bp = Blueprint('auditoria', __name__)


@bp.get('/')
@jwt_required()
@requiere_permiso('gestionar_usuarios')
def listar():
    q = request.args.get('q', '').strip()
    usuario_filtro = request.args.get('usuario', '').strip()
    accion_filtro = request.args.get('accion', '').strip()
    modulo_filtro = request.args.get('modulo', '').strip()
    fecha_desde = request.args.get('fecha_desde', '').strip()
    fecha_hasta = request.args.get('fecha_hasta', '').strip()
    page = max(1, int(request.args.get('page', 1)))
    per_page = min(200, max(1, int(request.args.get('per_page', 50))))

    consulta = (
        db.session.query(Bitacora, Usuario.username)
        .outerjoin(Usuario, Bitacora.id_usuario == Usuario.id)
        .order_by(Bitacora.fecha.desc())
    )

    if q:
        consulta = consulta.filter(Bitacora.descripcion.ilike(f'%{q}%'))
    if usuario_filtro:
        consulta = consulta.filter(Usuario.username.ilike(f'%{usuario_filtro}%'))
    if accion_filtro:
        consulta = consulta.filter(Bitacora.accion == accion_filtro)
    if modulo_filtro:
        consulta = consulta.filter(Bitacora.modulo == modulo_filtro)
    if fecha_desde:
        consulta = consulta.filter(Bitacora.fecha >= fecha_desde)
    if fecha_hasta:
        consulta = consulta.filter(Bitacora.fecha <= f'{fecha_hasta} 23:59:59')

    total = consulta.count()
    filas = consulta.offset((page - 1) * per_page).limit(per_page).all()

    items = [_serializar(b, username) for b, username in filas]

    return jsonify({
        'items': items,
        'total': total,
        'page': page,
        'pages': max(1, (total + per_page - 1) // per_page),
        'per_page': per_page,
    })


@bp.get('/<int:id_bitacora>')
@jwt_required()
@requiere_permiso('gestionar_usuarios')
def obtener(id_bitacora):
    b = db.get_or_404(Bitacora, id_bitacora)
    username = b.usuario.username if b.usuario else None
    data = _serializar(b, username)
    data['detalles'] = [
        {
            'campo': d.campo,
            'valor_anterior': d.valor_anterior,
            'valor_nuevo': d.valor_nuevo,
        }
        for d in b.detalles
    ]
    return jsonify(data)


@bp.get('/acciones')
@jwt_required()
@requiere_permiso('gestionar_usuarios')
def listar_acciones():
    acciones = db.session.query(Bitacora.accion).distinct().order_by(Bitacora.accion).all()
    return jsonify([a[0] for a in acciones])


@bp.get('/modulos')
@jwt_required()
@requiere_permiso('gestionar_usuarios')
def listar_modulos():
    modulos = (db.session.query(Bitacora.modulo)
               .filter(Bitacora.modulo.isnot(None))
               .distinct()
               .order_by(Bitacora.modulo)
               .all())
    return jsonify([m[0] for m in modulos])


def _serializar(b: Bitacora, username) -> dict:
    return {
        'id': b.id,
        'id_usuario': b.id_usuario,
        'usuario': username,
        'accion': b.accion,
        'modulo': b.modulo,
        'descripcion': b.descripcion,
        'ip': b.ip,
        'fecha': b.fecha.isoformat() if b.fecha else None,
    }
