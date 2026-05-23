from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from ...extensions import db
from ...models.entidades.entidad import Entidad, EntidadNatural, EntidadJuridica, Establecimiento, Sistema
from ...models.catalogo.catalogo import Telefono, Municipio, TipoEstablecimiento, TipoSistema
from ...models.bitacoras.bitacora_doc import BitacoraCliente
from ...utils.bitacora import log
from ...utils.permisos import requiere_permiso

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


# ── CRUD Establecimientos ────────────────────────────────────────

@bp.get('/establecimientos')
@jwt_required()
@requiere_permiso('ver_clientes')
def listar_establecimientos():
    ests = (
        Establecimiento.query
        .filter_by(estado=True)
        .order_by(Establecimiento.fecha_creacion.desc())
        .all()
    )
    return jsonify([_serializar_establecimiento(e) for e in ests])


@bp.post('/establecimientos')
@jwt_required()
@requiere_permiso('crear_clientes')
def crear_establecimiento():
    data = request.get_json()
    usuario = get_jwt_identity()

    if not data.get('id_entidad'):
        return jsonify({'error': 'El cliente es requerido'}), 400
    if not (data.get('direccion') or '').strip():
        return jsonify({'error': 'La dirección es requerida'}), 400

    entidad = db.get_or_404(Entidad, data['id_entidad'])
    est = Establecimiento(
        id_entidad=data['id_entidad'],
        id_municipio=data.get('id_municipio') or None,
        id_tipo_establecimiento=data.get('id_tipo_establecimiento') or None,
        direccion=data['direccion'].strip(),
    )
    db.session.add(est)
    db.session.commit()
    log('CREAR_ESTABLECIMIENTO', f"Establecimiento creado para '{entidad.nombre}'",
        id_usuario=int(usuario), modulo='entidades')
    return jsonify(_serializar_establecimiento(est)), 201


@bp.put('/establecimientos/<int:id_est>')
@jwt_required()
@requiere_permiso('editar_clientes')
def actualizar_establecimiento(id_est):
    est = db.get_or_404(Establecimiento, id_est)
    data = request.get_json()
    usuario = get_jwt_identity()

    if data.get('id_entidad'):
        est.id_entidad = data['id_entidad']
    if 'id_municipio' in data:
        est.id_municipio = data['id_municipio'] or None
    if 'id_tipo_establecimiento' in data:
        est.id_tipo_establecimiento = data['id_tipo_establecimiento'] or None
    if data.get('direccion', '').strip():
        est.direccion = data['direccion'].strip()

    db.session.commit()
    log('ACTUALIZAR_ESTABLECIMIENTO', f"Establecimiento {id_est} actualizado",
        id_usuario=int(usuario), modulo='entidades')
    return jsonify(_serializar_establecimiento(est))


@bp.delete('/establecimientos/<int:id_est>')
@jwt_required()
@requiere_permiso('editar_clientes')
def desactivar_establecimiento(id_est):
    est = db.get_or_404(Establecimiento, id_est)
    est.estado = False
    db.session.commit()
    log('DESACTIVAR_ESTABLECIMIENTO', f"Establecimiento {id_est} desactivado",
        id_usuario=int(get_jwt_identity()), modulo='entidades')
    return jsonify({'mensaje': 'Establecimiento desactivado'})


# ── CRUD Sistemas ────────────────────────────────────────────────

@bp.get('/sistemas')
@jwt_required()
@requiere_permiso('ver_clientes')
def listar_sistemas_global():
    sistemas = (
        Sistema.query
        .filter_by(estado=True)
        .order_by(Sistema.fecha_creacion.desc())
        .all()
    )
    return jsonify([_serializar_sistema(s) for s in sistemas])


@bp.post('/sistemas')
@jwt_required()
@requiere_permiso('editar_clientes')
def crear_sistema_global():
    data = request.get_json()
    usuario = get_jwt_identity()

    if not data.get('id_establecimiento'):
        return jsonify({'error': 'El establecimiento es requerido'}), 400
    if not data.get('id_tipo_sistema'):
        return jsonify({'error': 'El tipo de sistema es requerido'}), 400
    if not (data.get('nombre') or '').strip():
        return jsonify({'error': 'El nombre del sistema es requerido'}), 400

    db.get_or_404(Establecimiento, data['id_establecimiento'])
    sistema = Sistema(
        id_establecimiento=data['id_establecimiento'],
        id_tipo_sistema=data['id_tipo_sistema'],
        nombre=data['nombre'].strip(),
        tiene_mantenimiento=data.get('tiene_mantenimiento', False),
        periodicidad_dias=data.get('periodicidad_dias') or None,
    )
    db.session.add(sistema)
    db.session.commit()
    log('CREAR_SISTEMA', f"Sistema '{sistema.nombre}' creado",
        id_usuario=int(usuario), modulo='entidades')
    return jsonify(_serializar_sistema(sistema)), 201


@bp.put('/sistemas/<int:id_sis>')
@jwt_required()
@requiere_permiso('editar_clientes')
def actualizar_sistema(id_sis):
    sistema = db.get_or_404(Sistema, id_sis)
    data = request.get_json()
    usuario = get_jwt_identity()

    if data.get('id_establecimiento'):
        sistema.id_establecimiento = data['id_establecimiento']
    if data.get('id_tipo_sistema'):
        sistema.id_tipo_sistema = data['id_tipo_sistema']
    if (data.get('nombre') or '').strip():
        sistema.nombre = data['nombre'].strip()
    if 'tiene_mantenimiento' in data:
        sistema.tiene_mantenimiento = data['tiene_mantenimiento']
    if 'periodicidad_dias' in data:
        sistema.periodicidad_dias = data['periodicidad_dias'] or None

    db.session.commit()
    log('ACTUALIZAR_SISTEMA', f"Sistema {id_sis} actualizado",
        id_usuario=int(usuario), modulo='entidades')
    return jsonify(_serializar_sistema(sistema))


@bp.delete('/sistemas/<int:id_sis>')
@jwt_required()
@requiere_permiso('editar_clientes')
def desactivar_sistema(id_sis):
    sistema = db.get_or_404(Sistema, id_sis)
    sistema.estado = False
    db.session.commit()
    log('DESACTIVAR_SISTEMA', f"Sistema {id_sis} desactivado",
        id_usuario=int(get_jwt_identity()), modulo='entidades')
    return jsonify({'mensaje': 'Sistema desactivado'})


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
    from ...models.seguridad.auth import Usuario
    usuario = db.session.get(Usuario, n.id_usuario)
    return {
        'id': n.id,
        'id_entidad': n.id_entidad,
        'id_usuario': n.id_usuario,
        'usuario': usuario.username if usuario else '—',
        'nota': n.nota,
        'fecha_creacion': n.fecha_creacion.isoformat() if n.fecha_creacion else None,
    }


def _serializar_establecimiento(est: Establecimiento) -> dict:
    municipio = db.session.get(Municipio, est.id_municipio) if est.id_municipio else None
    tipo = db.session.get(TipoEstablecimiento, est.id_tipo_establecimiento) if est.id_tipo_establecimiento else None
    entidad = db.session.get(Entidad, est.id_entidad) if est.id_entidad else None
    return {
        'id': est.id,
        'id_entidad': est.id_entidad,
        'nombre_cliente': entidad.nombre if entidad else '—',
        'id_municipio': est.id_municipio,
        'nombre_municipio': municipio.nombre if municipio else None,
        'id_tipo_establecimiento': est.id_tipo_establecimiento,
        'nombre_tipo': tipo.nombre if tipo else None,
        'direccion': est.direccion,
        'estado': est.estado,
        'fecha_creacion': est.fecha_creacion.isoformat() if est.fecha_creacion else None,
    }


def _serializar_sistema(s: Sistema) -> dict:
    est = db.session.get(Establecimiento, s.id_establecimiento) if s.id_establecimiento else None
    entidad = db.session.get(Entidad, est.id_entidad) if est else None
    tipo = db.session.get(TipoSistema, s.id_tipo_sistema) if s.id_tipo_sistema else None
    return {
        'id': s.id,
        'nombre': s.nombre,
        'id_establecimiento': s.id_establecimiento,
        'direccion_establecimiento': est.direccion if est else None,
        'id_entidad': est.id_entidad if est else None,
        'nombre_cliente': entidad.nombre if entidad else '—',
        'id_tipo_sistema': s.id_tipo_sistema,
        'nombre_tipo_sistema': tipo.nombre if tipo else None,
        'tiene_mantenimiento': s.tiene_mantenimiento,
        'periodicidad_dias': s.periodicidad_dias,
        'estado': s.estado,
        'fecha_creacion': s.fecha_creacion.isoformat() if s.fecha_creacion else None,
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
