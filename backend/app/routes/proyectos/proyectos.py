from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime
from ...extensions import db
from ...models.proyectos.proyecto import Proyecto, ProyectoHistorial, EstadoProyecto
from ...models.entidades.entidad import Establecimiento
from ...utils.bitacora import log
from ...utils.permisos import requiere_permiso

bp = Blueprint('proyectos', __name__)


@bp.get('/')
@jwt_required()
@requiere_permiso('ver_proyectos')
def listar():
    proyectos = Proyecto.query.order_by(Proyecto.id.desc()).all()
    return jsonify([_serializar(p) for p in proyectos])


@bp.get('/estados')
@jwt_required()
@requiere_permiso('ver_proyectos')
def listar_estados():
    estados = EstadoProyecto.query.order_by(EstadoProyecto.orden).all()
    return jsonify([{'id': e.id, 'nombre': e.nombre, 'orden': e.orden} for e in estados])


@bp.get('/<int:id_proyecto>')
@jwt_required()
@requiere_permiso('ver_proyectos')
def obtener(id_proyecto):
    p = db.get_or_404(Proyecto, id_proyecto)
    return jsonify(_serializar(p, detalle=True))


@bp.post('/')
@jwt_required()
@requiere_permiso('crear_proyectos')
def crear():
    data = request.get_json()
    id_usuario = int(get_jwt_identity())

    for campo in ['id_entidad', 'id_servicio', 'id_sistema', 'titulo', 'id_estado_proyecto']:
        if not data.get(campo):
            return jsonify({'error': f'El campo {campo} es requerido'}), 400

    from ...models.entidades.entidad import Sistema
    sistema = db.get_or_404(Sistema, data['id_sistema'])
    id_establecimiento = data.get('id_establecimiento') or sistema.id_establecimiento

    prefijo = datetime.now().strftime('PROY-%Y%m-')
    ultimo = (Proyecto.query
              .filter(Proyecto.codigo.like(f'{prefijo}%'))
              .order_by(Proyecto.id.desc())
              .first())
    siguiente = 1
    if ultimo:
        try:
            siguiente = int(ultimo.codigo.split('-')[-1]) + 1
        except ValueError:
            pass
    codigo = f"{prefijo}{siguiente:04d}"

    proyecto = Proyecto(
        codigo=codigo,
        id_entidad=data['id_entidad'],
        id_establecimiento=id_establecimiento,
        id_servicio=data['id_servicio'],
        id_estado_proyecto=data['id_estado_proyecto'],
        id_usuario=id_usuario,
        id_cotizacion=data.get('id_cotizacion') or None,
        id_sistema=data['id_sistema'],
        titulo=data['titulo'].strip(),
        descripcion=data.get('descripcion', '').strip() or None,
        fecha_inicio=data.get('fecha_inicio') or None,
        fecha_fin=data.get('fecha_fin') or None,
    )
    db.session.add(proyecto)
    db.session.flush()

    historial = ProyectoHistorial(
        id_proyecto=proyecto.id,
        id_estado_anterior=None,
        id_estado_nuevo=data['id_estado_proyecto'],
        id_usuario=id_usuario,
        observacion='Proyecto creado',
    )
    db.session.add(historial)
    db.session.commit()

    log('CREAR_PROYECTO', f"Proyecto '{codigo}' creado", id_usuario=id_usuario, modulo='proyectos')
    return jsonify(_serializar(proyecto, detalle=True)), 201


@bp.put('/<int:id_proyecto>')
@jwt_required()
@requiere_permiso('editar_proyectos')
def actualizar(id_proyecto):
    p = db.get_or_404(Proyecto, id_proyecto)
    data = request.get_json()
    id_usuario = int(get_jwt_identity())

    campos_seguimiento = ('titulo', 'descripcion', 'fecha_inicio', 'fecha_fin', 'id_estado_proyecto')
    antes = {c: getattr(p, c) for c in campos_seguimiento}

    if 'titulo' in data:
        p.titulo = data['titulo'].strip()
    if 'descripcion' in data:
        p.descripcion = data['descripcion'].strip() or None
    if 'fecha_inicio' in data:
        p.fecha_inicio = data['fecha_inicio'] or None
    if 'fecha_fin' in data:
        p.fecha_fin = data['fecha_fin'] or None

    if 'id_estado_proyecto' in data and data['id_estado_proyecto'] != p.id_estado_proyecto:
        p.id_estado_proyecto = data['id_estado_proyecto']
        historial = ProyectoHistorial(
            id_proyecto=p.id,
            id_estado_anterior=antes['id_estado_proyecto'],
            id_estado_nuevo=data['id_estado_proyecto'],
            id_usuario=id_usuario,
            observacion=data.get('observacion_cambio', ''),
        )
        db.session.add(historial)

    db.session.commit()

    cambios = [
        {'campo': c, 'anterior': antes[c], 'nuevo': getattr(p, c)}
        for c in campos_seguimiento
        if c in data and str(antes[c] or '') != str(getattr(p, c) or '')
    ]
    log('ACTUALIZAR_PROYECTO', f"Proyecto {id_proyecto} actualizado",
        id_usuario=id_usuario, modulo='proyectos', detalles=cambios or None)
    return jsonify(_serializar(p, detalle=True))


def _serializar(p: Proyecto, detalle: bool = False) -> dict:
    data = {
        'id': p.id,
        'codigo': p.codigo,
        'titulo': p.titulo,
        'id_entidad': p.id_entidad,
        'id_establecimiento': p.id_establecimiento,
        'id_servicio': p.id_servicio,
        'id_sistema': p.id_sistema,
        'id_estado_proyecto': p.id_estado_proyecto,
        'estado_nombre': p.estado.nombre if p.estado else None,
        'id_cotizacion': p.id_cotizacion,
        'descripcion': p.descripcion,
        'fecha_inicio': p.fecha_inicio.isoformat() if p.fecha_inicio else None,
        'fecha_fin': p.fecha_fin.isoformat() if p.fecha_fin else None,
        'fecha_creacion': p.fecha_creacion.isoformat() if p.fecha_creacion else None,
    }
    if detalle:
        estados_map = {e.id: e.nombre for e in EstadoProyecto.query.all()}
        data['historial'] = [
            {
                'id_estado_anterior': h.id_estado_anterior,
                'estado_anterior': estados_map.get(h.id_estado_anterior),
                'id_estado_nuevo': h.id_estado_nuevo,
                'estado_nuevo': estados_map.get(h.id_estado_nuevo),
                'fecha_cambio': h.fecha_cambio.isoformat() if h.fecha_cambio else None,
                'observacion': h.observacion,
                'id_usuario': h.id_usuario,
            }
            for h in sorted(p.historial, key=lambda h: h.fecha_cambio or datetime.min)
        ]
    return data
