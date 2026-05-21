from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from ..extensions import db
from ..models.entidad import Entidad, EntidadNatural, EntidadJuridica, Establecimiento, Sistema
from ..models.catalogo import Telefono
from ..models.bitacora_doc import BitacoraCliente
from ..bitacora import log
from ..permisos import requiere_permiso

bp = Blueprint('entidades', __name__)


@bp.get('/')
@jwt_required()
@requiere_permiso('ver_clientes')
def listar():
    entidades = Entidad.query.filter_by(estado=True).all()
    return jsonify([_serializar(e) for e in entidades])


@bp.get('/<int:id_entidad>')
@jwt_required()
@requiere_permiso('ver_clientes')
def obtener(id_entidad):
    entidad = db.get_or_404(Entidad, id_entidad)
    return jsonify(_serializar(entidad))


@bp.post('/')
@jwt_required()
@requiere_permiso('crear_clientes')
def crear():
    data = request.get_json()
    usuario = get_jwt_identity()

    tipo = data.get('tipo')
    if tipo not in ('natural', 'juridica'):
        return jsonify({'error': 'El tipo debe ser "natural" o "juridica"'}), 400

    if tipo == 'natural':
        if not data.get('nombre') or not data.get('ci'):
            return jsonify({'error': 'Nombre y CI son obligatorios para persona natural'}), 400
        if EntidadNatural.query.filter_by(ci=data['ci']).first():
            return jsonify({'error': 'Ya existe una entidad con ese CI'}), 409
    else:
        if not data.get('razon_social'):
            return jsonify({'error': 'La razón social es obligatoria para persona jurídica'}), 400
        if data.get('nit') and EntidadJuridica.query.filter_by(nit=data['nit']).first():
            return jsonify({'error': 'Ya existe una entidad con ese NIT'}), 409

    entidad = Entidad(
        nombre=data.get('nombre') or data.get('razon_social'),
        tipo=tipo,
        email=data.get('email'),
        cliente=data.get('cliente', False),
        empleado=data.get('empleado', False),
    )
    db.session.add(entidad)
    db.session.flush()

    if tipo == 'natural':
        natural = EntidadNatural(
            id_entidad=entidad.id,
            ci=data['ci'].strip(),
            sexo=data.get('sexo'),
            fecha_nacimiento=data.get('fecha_nacimiento') or None,
        )
        db.session.add(natural)
    else:
        juridica = EntidadJuridica(
            id_entidad=entidad.id,
            razon_social=data['razon_social'].strip(),
            nombre_comercial=data.get('nombre_comercial', '').strip() or None,
            nit=data.get('nit', '').strip() or None,
        )
        db.session.add(juridica)

    id_usuario = int(usuario)
    db.session.commit()
    log('CREAR_ENTIDAD', f"Entidad '{entidad.nombre}' ({tipo}) creada", id_usuario=id_usuario, modulo='entidades')
    return jsonify(_serializar(entidad)), 201


@bp.put('/<int:id_entidad>')
@jwt_required()
@requiere_permiso('editar_clientes')
def actualizar(id_entidad):
    entidad = db.get_or_404(Entidad, id_entidad)
    data = request.get_json()
    usuario = get_jwt_identity()

    if 'email' in data:
        entidad.email = data['email'] or None
    if 'cliente' in data:
        entidad.cliente = data['cliente']
    if 'empleado' in data:
        entidad.empleado = data['empleado']

    if entidad.tipo == 'natural' and entidad.natural:
        if 'nombre' in data:
            entidad.nombre = data['nombre'].strip()
        if 'ci' in data:
            ci_nuevo = data['ci'].strip()
            existente = EntidadNatural.query.filter_by(ci=ci_nuevo).first()
            if existente and existente.id_entidad != id_entidad:
                return jsonify({'error': 'Ya existe una entidad con ese CI'}), 409
            entidad.natural.ci = ci_nuevo
        if 'sexo' in data:
            entidad.natural.sexo = data['sexo']
        if 'fecha_nacimiento' in data:
            entidad.natural.fecha_nacimiento = data['fecha_nacimiento'] or None

    elif entidad.tipo == 'juridica' and entidad.juridica:
        if 'razon_social' in data:
            entidad.nombre = data['razon_social'].strip()
            entidad.juridica.razon_social = data['razon_social'].strip()
        if 'nombre_comercial' in data:
            entidad.juridica.nombre_comercial = data['nombre_comercial'].strip() or None
        if 'nit' in data:
            nit_nuevo = data['nit'].strip() or None
            if nit_nuevo:
                existente = EntidadJuridica.query.filter_by(nit=nit_nuevo).first()
                if existente and existente.id_entidad != id_entidad:
                    return jsonify({'error': 'Ya existe una entidad con ese NIT'}), 409
            entidad.juridica.nit = nit_nuevo

    db.session.commit()
    log('ACTUALIZAR_ENTIDAD', f"Entidad {id_entidad} actualizada", id_usuario=int(usuario), modulo='entidades')
    return jsonify(_serializar(entidad))


@bp.delete('/<int:id_entidad>')
@jwt_required()
@requiere_permiso('editar_clientes')
def desactivar(id_entidad):
    entidad = db.get_or_404(Entidad, id_entidad)
    entidad.estado = False
    db.session.commit()
    usuario = get_jwt_identity()
    log('DESACTIVAR_ENTIDAD', f"Entidad {id_entidad} desactivada", id_usuario=int(usuario), modulo='entidades')
    return jsonify({'mensaje': 'Entidad desactivada'})


@bp.get('/<int:id_entidad>/sistemas')
@jwt_required()
@requiere_permiso('ver_clientes')
def listar_sistemas(id_entidad):
    sistemas = (
        Sistema.query
        .join(Establecimiento, Sistema.id_establecimiento == Establecimiento.id)
        .filter(Establecimiento.id_entidad == id_entidad, Sistema.estado == True)
        .all()
    )
    return jsonify([_serializar_sistema(s) for s in sistemas])


@bp.post('/<int:id_entidad>/sistemas')
@jwt_required()
@requiere_permiso('editar_clientes')
def crear_sistema(id_entidad):
    entidad = db.get_or_404(Entidad, id_entidad)
    data = request.get_json()
    usuario = get_jwt_identity()

    if not data.get('id_tipo_sistema'):
        return jsonify({'error': 'El tipo de sistema es requerido'}), 400
    if not data.get('nombre'):
        return jsonify({'error': 'El nombre del sistema es requerido'}), 400

    establecimiento = (
        Establecimiento.query
        .filter_by(id_entidad=id_entidad, estado=True)
        .first()
    )
    if not establecimiento:
        if not data.get('direccion'):
            return jsonify({'error': 'La entidad no tiene establecimientos. Ingresá una dirección para crear uno.'}), 400
        establecimiento = Establecimiento(
            id_entidad=id_entidad,
            id_municipio=data.get('id_municipio'),
            id_tipo_establecimiento=data.get('id_tipo_establecimiento'),
            direccion=data['direccion'].strip(),
        )
        db.session.add(establecimiento)
        db.session.flush()

    sistema = Sistema(
        id_establecimiento=establecimiento.id,
        id_tipo_sistema=data['id_tipo_sistema'],
        nombre=data['nombre'].strip(),
        tiene_mantenimiento=data.get('tiene_mantenimiento', False),
        periodicidad_dias=data.get('periodicidad_dias') or None,
    )
    db.session.add(sistema)
    db.session.commit()
    log('CREAR_SISTEMA', f"Sistema '{sistema.nombre}' creado para entidad {id_entidad}", id_usuario=int(usuario), modulo='entidades')
    return jsonify(_serializar_sistema(sistema)), 201


# ── CU28: Bitácora de cliente ─────────────────────────────────────

@bp.get('/<int:id_entidad>/bitacora')
@jwt_required()
@requiere_permiso('ver_clientes')
def listar_bitacora(id_entidad):
    db.get_or_404(Entidad, id_entidad)
    notas = (
        BitacoraCliente.query
        .filter_by(id_entidad=id_entidad)
        .order_by(BitacoraCliente.fecha_creacion.desc())
        .all()
    )
    return jsonify([_serializar_nota(n) for n in notas])


@bp.post('/<int:id_entidad>/bitacora')
@jwt_required()
@requiere_permiso('ver_clientes')
def crear_nota_bitacora(id_entidad):
    entidad = db.get_or_404(Entidad, id_entidad)
    data = request.get_json()
    id_usuario = int(get_jwt_identity())

    nota_texto = (data.get('nota') or '').strip()
    if not nota_texto:
        return jsonify({'error': 'La nota no puede estar vacía'}), 400

    nota = BitacoraCliente(
        id_entidad=id_entidad,
        id_usuario=id_usuario,
        nota=nota_texto,
    )
    db.session.add(nota)
    db.session.commit()

    log('NOTA_BITACORA_CLIENTE', f"Nota registrada para cliente '{entidad.nombre}'",
        id_usuario=id_usuario, modulo='entidades')
    return jsonify(_serializar_nota(nota)), 201


def _serializar_nota(n: BitacoraCliente) -> dict:
    from ..models.auth import Usuario
    usuario = db.session.get(Usuario, n.id_usuario)
    return {
        'id': n.id,
        'id_entidad': n.id_entidad,
        'id_usuario': n.id_usuario,
        'usuario': usuario.username if usuario else '—',
        'nota': n.nota,
        'fecha_creacion': n.fecha_creacion.isoformat() if n.fecha_creacion else None,
    }


def _serializar_sistema(s: Sistema) -> dict:
    return {
        'id': s.id,
        'nombre': s.nombre,
        'id_establecimiento': s.id_establecimiento,
        'id_tipo_sistema': s.id_tipo_sistema,
        'tiene_mantenimiento': s.tiene_mantenimiento,
        'periodicidad_dias': s.periodicidad_dias,
    }


def _serializar(e: Entidad) -> dict:
    base = {
        'id': e.id,
        'tipo': e.tipo,
        'email': e.email,
        'cliente': e.cliente,
        'empleado': e.empleado,
        'estado': e.estado,
        'fecha_registro': e.fecha_registro.isoformat() if e.fecha_registro else None,
    }
    if e.natural:
        base['nombre'] = e.nombre
        base['ci'] = e.natural.ci
        base['sexo'] = e.natural.sexo
        base['fecha_nacimiento'] = e.natural.fecha_nacimiento.isoformat() if e.natural.fecha_nacimiento else None
    elif e.juridica:
        base['nombre'] = e.juridica.razon_social
        base['nombre_comercial'] = e.juridica.nombre_comercial
        base['nit'] = e.juridica.nit
    return base
