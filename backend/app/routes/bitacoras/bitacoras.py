"""Paquete Bitácoras y Documentos.

Gestiona el registro histórico de notas asociadas a clientes y proyectos,
documentadas en texto libre y vinculadas automáticamente al usuario y la
fecha de creación. Administra además los documentos adjuntos asociados a
proyectos o entidades, clasificados por tipo de documento.

Las operaciones por recurso (crear/listar notas de un cliente o proyecto,
subir/descargar documentos de un proyecto) están anidadas en sus módulos:
  - routes/entidades/entidades.py  → /api/entidades/<id>/bitacora   (CU28)
  - routes/proyectos/proyectos.py  → /api/proyectos/<id>/bitacora
                                     /api/proyectos/<id>/documentos (CU30)

Este módulo expone las vistas transversales del paquete: el historial
consolidado de notas (clientes + proyectos) y el repositorio general de
documentos con filtros por tipo, proyecto o entidad.
"""
from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required
from ...extensions import db
from ...models.bitacoras.bitacora_doc import BitacoraCliente, BitacoraProyecto, Documento
from ...models.catalogo.catalogo import TipoDocumento
from ...models.entidades.entidad import Entidad
from ...models.proyectos.proyecto import Proyecto
from ...models.seguridad.auth import Usuario
from ...utils.permisos import requiere_alguno

bp = Blueprint('bitacoras', __name__)


# ── Historial consolidado de notas ────────────────────────────────

@bp.get('/notas')
@jwt_required()
@requiere_alguno('ver_clientes', 'ver_proyectos')
def listar_notas():
    """Notas de bitácora de clientes y proyectos en un solo historial.

    Filtros opcionales: ?origen=cliente|proyecto y ?limite=N (50 por defecto).
    """
    origen = request.args.get('origen')
    limite = request.args.get('limite', 50, type=int)

    notas = []
    if origen in (None, '', 'cliente'):
        consulta = (BitacoraCliente.query
                    .order_by(BitacoraCliente.fecha_creacion.desc())
                    .limit(limite).all())
        notas += [_serializar_nota(n, 'cliente') for n in consulta]
    if origen in (None, '', 'proyecto'):
        consulta = (BitacoraProyecto.query
                    .order_by(BitacoraProyecto.fecha_creacion.desc())
                    .limit(limite).all())
        notas += [_serializar_nota(n, 'proyecto') for n in consulta]

    notas.sort(key=lambda n: n['fecha_creacion'] or '', reverse=True)
    return jsonify(notas[:limite])


def _serializar_nota(n, origen: str) -> dict:
    usuario = db.session.get(Usuario, n.id_usuario)
    if origen == 'cliente':
        entidad = db.session.get(Entidad, n.id_entidad)
        referencia = entidad.nombre if entidad else '—'
        id_referencia = n.id_entidad
    else:
        proyecto = db.session.get(Proyecto, n.id_proyecto)
        referencia = f"{proyecto.codigo} — {proyecto.titulo}" if proyecto else '—'
        id_referencia = n.id_proyecto
    return {
        'id': n.id,
        'origen': origen,
        'id_referencia': id_referencia,
        'referencia': referencia,
        'id_usuario': n.id_usuario,
        'usuario': usuario.username if usuario else '—',
        'nota': n.nota,
        'fecha_creacion': n.fecha_creacion.isoformat() if n.fecha_creacion else None,
    }


# ── Repositorio general de documentos ─────────────────────────────

@bp.get('/documentos')
@jwt_required()
@requiere_alguno('ver_clientes', 'ver_proyectos')
def listar_documentos():
    """Documentos adjuntos del sistema, clasificados por tipo.

    Filtros opcionales: ?id_tipo_documento, ?id_proyecto, ?id_entidad
    y ?buscar (por nombre o descripción).
    """
    consulta = Documento.query

    id_tipo = request.args.get('id_tipo_documento', type=int)
    if id_tipo:
        consulta = consulta.filter_by(id_tipo_documento=id_tipo)

    id_proyecto = request.args.get('id_proyecto', type=int)
    if id_proyecto:
        consulta = consulta.filter_by(id_proyecto=id_proyecto)

    id_entidad = request.args.get('id_entidad', type=int)
    if id_entidad:
        consulta = consulta.filter_by(id_entidad=id_entidad)

    buscar = (request.args.get('buscar') or '').strip()
    if buscar:
        patron = f'%{buscar}%'
        consulta = consulta.filter(db.or_(
            Documento.nombre.ilike(patron),
            Documento.descripcion.ilike(patron),
        ))

    docs = consulta.order_by(Documento.fecha_subida.desc()).all()
    return jsonify([_serializar_documento(d) for d in docs])


def _serializar_documento(d: Documento) -> dict:
    usuario = db.session.get(Usuario, d.id_usuario)
    tipo = db.session.get(TipoDocumento, d.id_tipo_documento) if d.id_tipo_documento else None
    proyecto = db.session.get(Proyecto, d.id_proyecto) if d.id_proyecto else None
    entidad = db.session.get(Entidad, d.id_entidad) if d.id_entidad else None
    return {
        'id': d.id,
        'nombre': d.nombre,
        'descripcion': d.descripcion,
        'id_tipo_documento': d.id_tipo_documento,
        'tipo_documento': tipo.nombre if tipo else '—',
        'id_proyecto': d.id_proyecto,
        'proyecto': proyecto.codigo if proyecto else None,
        'id_entidad': d.id_entidad,
        'entidad': entidad.nombre if entidad else None,
        'id_usuario': d.id_usuario,
        'usuario': usuario.username if usuario else '—',
        'fecha_subida': d.fecha_subida.isoformat() if d.fecha_subida else None,
    }
