import os
import uuid
from flask import Blueprint, request, jsonify, current_app, send_from_directory
from flask_jwt_extended import jwt_required, get_jwt_identity
from werkzeug.utils import secure_filename
from ...extensions import db
from ...utils.timezone import ahora_bolivia
from ...models.proyectos.proyecto import Proyecto, ProyectoHistorial, EstadoProyecto
from ...models.entidades.entidad import Establecimiento
from ...models.bitacoras.bitacora_doc import BitacoraProyecto, Documento
from ...models.catalogo.catalogo import TipoDocumento
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

    prefijo = ahora_bolivia().strftime('PROY-%Y%m-')
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


# ── Bitácora de proyecto ─────────────────────────────────────────

@bp.get('/<int:id_proyecto>/bitacora')
@jwt_required()
@requiere_permiso('ver_proyectos')
def listar_bitacora(id_proyecto):
    db.get_or_404(Proyecto, id_proyecto)
    notas = (
        BitacoraProyecto.query
        .filter_by(id_proyecto=id_proyecto)
        .order_by(BitacoraProyecto.fecha_creacion.desc())
        .all()
    )
    return jsonify([_serializar_nota(n) for n in notas])


@bp.post('/<int:id_proyecto>/bitacora')
@jwt_required()
@requiere_permiso('ver_proyectos')
def crear_nota_bitacora(id_proyecto):
    proyecto = db.get_or_404(Proyecto, id_proyecto)
    data = request.get_json()
    id_usuario = int(get_jwt_identity())

    nota_texto = (data.get('nota') or '').strip()
    if not nota_texto:
        return jsonify({'error': 'La nota no puede estar vacía'}), 400

    nota = BitacoraProyecto(
        id_proyecto=id_proyecto,
        id_usuario=id_usuario,
        nota=nota_texto,
    )
    db.session.add(nota)
    db.session.commit()

    log('NOTA_BITACORA_PROYECTO', f"Nota registrada en proyecto '{proyecto.codigo}'",
        id_usuario=id_usuario, modulo='proyectos')
    return jsonify(_serializar_nota(nota)), 201


def _serializar_nota(n: BitacoraProyecto) -> dict:
    from ...models.seguridad.auth import Usuario
    usuario = db.session.get(Usuario, n.id_usuario)
    return {
        'id': n.id,
        'id_proyecto': n.id_proyecto,
        'id_usuario': n.id_usuario,
        'usuario': usuario.username if usuario else '—',
        'nota': n.nota,
        'fecha_creacion': n.fecha_creacion.isoformat() if n.fecha_creacion else None,
    }


# ── CU30: Documentos de proyecto (upload real) ───────────────────

def _extension_permitida(filename: str) -> bool:
    ext = filename.rsplit('.', 1)[-1].lower() if '.' in filename else ''
    return ext in current_app.config.get('ALLOWED_EXTENSIONS', set())


@bp.get('/<int:id_proyecto>/documentos')
@jwt_required()
@requiere_permiso('ver_proyectos')
def listar_documentos(id_proyecto):
    db.get_or_404(Proyecto, id_proyecto)
    docs = (
        Documento.query
        .filter_by(id_proyecto=id_proyecto)
        .order_by(Documento.fecha_subida.desc())
        .all()
    )
    return jsonify([_serializar_documento(d) for d in docs])


@bp.post('/<int:id_proyecto>/documentos')
@jwt_required()
@requiere_permiso('ver_proyectos')
def subir_documento(id_proyecto):
    proyecto = db.get_or_404(Proyecto, id_proyecto)
    id_usuario = int(get_jwt_identity())

    nombre = (request.form.get('nombre') or '').strip()
    id_tipo = request.form.get('id_tipo_documento')
    descripcion = (request.form.get('descripcion') or '').strip() or None
    archivo = request.files.get('archivo')

    if not nombre:
        return jsonify({'error': 'El nombre del documento es requerido'}), 400
    if not id_tipo:
        return jsonify({'error': 'El tipo de documento es requerido'}), 400
    if not archivo or not archivo.filename:
        return jsonify({'error': 'Debe adjuntar un archivo'}), 400

    nombre_seguro = secure_filename(archivo.filename)
    if not _extension_permitida(nombre_seguro):
        exts = ', '.join(sorted(current_app.config.get('ALLOWED_EXTENSIONS', [])))
        return jsonify({'error': f'Tipo de archivo no permitido. Formatos aceptados: {exts}'}), 400

    nombre_guardado = f"{uuid.uuid4().hex}_{nombre_seguro}"
    upload_folder = current_app.config['UPLOAD_FOLDER']
    os.makedirs(upload_folder, exist_ok=True)
    archivo.save(os.path.join(upload_folder, nombre_guardado))

    doc = Documento(
        id_proyecto=id_proyecto,
        id_usuario=id_usuario,
        id_tipo_documento=int(id_tipo),
        nombre=nombre,
        ruta=nombre_guardado,
        descripcion=descripcion,
    )
    db.session.add(doc)
    db.session.commit()

    log('SUBIR_DOCUMENTO', f"Documento '{nombre}' subido al proyecto '{proyecto.codigo}'",
        id_usuario=id_usuario, modulo='proyectos')
    return jsonify(_serializar_documento(doc)), 201


@bp.get('/<int:id_proyecto>/documentos/<int:id_doc>/archivo')
@jwt_required()
@requiere_permiso('ver_proyectos')
def descargar_documento(id_proyecto, id_doc):
    doc = db.get_or_404(Documento, id_doc)
    if doc.id_proyecto != id_proyecto:
        return jsonify({'error': 'El documento no pertenece a este proyecto'}), 403

    upload_folder = current_app.config['UPLOAD_FOLDER']
    como_adjunto = request.args.get('dl') == '1'
    return send_from_directory(
        upload_folder,
        doc.ruta,
        as_attachment=como_adjunto,
        download_name=doc.nombre + ('.' + doc.ruta.rsplit('.', 1)[-1] if '.' in doc.ruta else ''),
    )


@bp.delete('/<int:id_proyecto>/documentos/<int:id_doc>')
@jwt_required()
@requiere_permiso('editar_proyectos')
def eliminar_documento(id_proyecto, id_doc):
    proyecto = db.get_or_404(Proyecto, id_proyecto)
    doc = db.get_or_404(Documento, id_doc)
    if doc.id_proyecto != id_proyecto:
        return jsonify({'error': 'El documento no pertenece a este proyecto'}), 403

    id_usuario = int(get_jwt_identity())
    nombre = doc.nombre

    # Eliminar el archivo físico
    ruta_fisica = os.path.join(current_app.config['UPLOAD_FOLDER'], doc.ruta)
    if os.path.exists(ruta_fisica):
        os.remove(ruta_fisica)

    db.session.delete(doc)
    db.session.commit()
    log('ELIMINAR_DOCUMENTO', f"Documento '{nombre}' eliminado del proyecto '{proyecto.codigo}'",
        id_usuario=id_usuario, modulo='proyectos')
    return jsonify({'ok': True})


def _serializar_documento(d: Documento) -> dict:
    from ...models.seguridad.auth import Usuario
    usuario = db.session.get(Usuario, d.id_usuario)
    tipo = db.session.get(TipoDocumento, d.id_tipo_documento) if d.id_tipo_documento else None
    return {
        'id': d.id,
        'id_proyecto': d.id_proyecto,
        'id_usuario': d.id_usuario,
        'usuario': usuario.username if usuario else '—',
        'id_tipo_documento': d.id_tipo_documento,
        'tipo_documento': tipo.nombre if tipo else '—',
        'nombre': d.nombre,
        'ruta': d.ruta,
        'descripcion': d.descripcion,
        'fecha_subida': d.fecha_subida.isoformat() if d.fecha_subida else None,
    }


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
