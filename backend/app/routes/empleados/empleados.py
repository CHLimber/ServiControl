from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy import text
from ...extensions import db
from ...models.entidades.entidad import Entidad, EntidadNatural, Empleado
from ...models.catalogo.catalogo import Cargo, Especialidad
from ...utils.bitacora import log
from ...utils.permisos import requiere_permiso

bp = Blueprint('empleados', __name__)


def _get_telefonos(id_entidad):
    rows = db.session.execute(
        text("SELECT t.numero FROM telefono t "
             "JOIN telefono_entidad te ON te.id_telefono = t.id "
             "WHERE te.id_entidad = :id"),
        {'id': id_entidad},
    ).fetchall()
    return [r[0] for r in rows]


def _set_telefonos(id_entidad, numeros):
    existing = db.session.execute(
        text("SELECT id_telefono FROM telefono_entidad WHERE id_entidad = :id"),
        {'id': id_entidad},
    ).fetchall()
    old_ids = [r[0] for r in existing]
    db.session.execute(
        text("DELETE FROM telefono_entidad WHERE id_entidad = :id"),
        {'id': id_entidad},
    )
    db.session.flush()
    for tid in old_ids:
        en_uso = db.session.execute(
            text("SELECT COUNT(*) FROM telefono_proveedor WHERE id_telefono = :id"),
            {'id': tid},
        ).scalar()
        if not en_uso:
            db.session.execute(text("DELETE FROM telefono WHERE id = :id"), {'id': tid})
    db.session.flush()
    from ...models.catalogo.catalogo import Telefono
    for numero in numeros:
        numero = (numero or '').strip()
        if numero:
            tel = Telefono(numero=numero)
            db.session.add(tel)
            db.session.flush()
            db.session.execute(
                text("INSERT INTO telefono_entidad (id_telefono, id_entidad) VALUES (:tid, :eid)"),
                {'tid': tel.id, 'eid': id_entidad},
            )


def _get_especialidades(id_empleado):
    rows = db.session.execute(
        text("SELECT e.id, e.nombre FROM especialidad e "
             "JOIN empleado_especialidad ee ON ee.id_especialidad = e.id "
             "WHERE ee.id_empleado = :id ORDER BY e.nombre"),
        {'id': id_empleado},
    ).fetchall()
    return [{'id': r[0], 'nombre': r[1]} for r in rows]


def _set_especialidades(id_empleado, ids):
    db.session.execute(
        text("DELETE FROM empleado_especialidad WHERE id_empleado = :id"),
        {'id': id_empleado},
    )
    db.session.flush()
    for id_esp in ids:
        db.session.execute(
            text("INSERT IGNORE INTO empleado_especialidad (id_empleado, id_especialidad) VALUES (:emp, :esp)"),
            {'emp': id_empleado, 'esp': int(id_esp)},
        )


def _serializar(emp: Empleado) -> dict:
    ent = emp.entidad
    cargo = db.session.get(Cargo, emp.id_cargo) if emp.id_cargo else None
    return {
        'id': emp.id,
        'id_entidad': emp.id_entidad,
        'nombre': ent.nombre if ent else f'Empleado #{emp.id}',
        'email': ent.email if ent else None,
        'ci': ent.natural.ci if ent and ent.natural else None,
        'sexo': ent.natural.sexo if ent and ent.natural else None,
        'fecha_nacimiento': (
            ent.natural.fecha_nacimiento.isoformat()
            if ent and ent.natural and ent.natural.fecha_nacimiento else None
        ),
        'id_cargo': emp.id_cargo,
        'cargo': cargo.nombre if cargo else None,
        'especialidades': _get_especialidades(emp.id),
        'telefonos': _get_telefonos(ent.id) if ent else [],
        'estado': emp.estado,
        'fecha_creacion': emp.fecha_creacion.isoformat() if emp.fecha_creacion else None,
    }


@bp.get('/')
@jwt_required()
@requiere_permiso('gestionar_empleados')
def listar():
    todos = request.args.get('todos', 'false').lower() == 'true'
    q = (
        Empleado.query
        .join(Entidad, Empleado.id_entidad == Entidad.id)
        .order_by(Entidad.nombre)
    )
    if not todos:
        q = q.filter(Empleado.estado == True)
    return jsonify([_serializar(e) for e in q.all()])


@bp.get('/<int:id_emp>')
@jwt_required()
@requiere_permiso('gestionar_empleados')
def obtener(id_emp):
    emp = db.get_or_404(Empleado, id_emp)
    return jsonify(_serializar(emp))


@bp.post('/')
@jwt_required()
@requiere_permiso('gestionar_empleados')
def crear():
    data = request.get_json()
    id_usuario = int(get_jwt_identity())

    nombre = (data.get('nombre') or '').strip()
    ci = (data.get('ci') or '').strip()
    if not nombre:
        return jsonify({'error': 'El nombre es obligatorio'}), 400
    if not ci:
        return jsonify({'error': 'El CI es obligatorio'}), 400
    if EntidadNatural.query.filter_by(ci=ci).first():
        return jsonify({'error': 'Ya existe una persona registrada con ese CI'}), 409

    entidad = Entidad(
        nombre=nombre,
        tipo='natural',
        email=(data.get('email') or '').strip() or None,
        empleado=True,
    )
    db.session.add(entidad)
    db.session.flush()

    natural = EntidadNatural(
        id_entidad=entidad.id,
        ci=ci,
        sexo=data.get('sexo') or None,
        fecha_nacimiento=data.get('fecha_nacimiento') or None,
    )
    db.session.add(natural)
    db.session.flush()

    emp = Empleado(
        id_entidad=entidad.id,
        id_cargo=data.get('id_cargo') or None,
        estado=True,
    )
    db.session.add(emp)
    db.session.flush()

    if data.get('especialidades'):
        _set_especialidades(emp.id, data['especialidades'])

    if data.get('telefonos'):
        _set_telefonos(entidad.id, data['telefonos'])

    db.session.commit()
    log('CREAR_EMPLEADO', f"Empleado '{nombre}' (CI {ci}) registrado",
        id_usuario=id_usuario, modulo='empleados')
    return jsonify(_serializar(emp)), 201


@bp.put('/<int:id_emp>')
@jwt_required()
@requiere_permiso('gestionar_empleados')
def actualizar(id_emp):
    emp = db.get_or_404(Empleado, id_emp)
    data = request.get_json()
    id_usuario = int(get_jwt_identity())
    ent = emp.entidad

    if 'nombre' in data:
        nombre = (data['nombre'] or '').strip()
        if not nombre:
            return jsonify({'error': 'El nombre es obligatorio'}), 400
        ent.nombre = nombre

    if 'email' in data:
        ent.email = (data['email'] or '').strip() or None

    if ent.natural:
        if 'ci' in data:
            ci_nuevo = (data['ci'] or '').strip()
            if not ci_nuevo:
                return jsonify({'error': 'El CI es obligatorio'}), 400
            existente = EntidadNatural.query.filter_by(ci=ci_nuevo).first()
            if existente and existente.id_entidad != ent.id:
                return jsonify({'error': 'Ya existe una persona registrada con ese CI'}), 409
            ent.natural.ci = ci_nuevo
        if 'sexo' in data:
            ent.natural.sexo = data['sexo'] or None
        if 'fecha_nacimiento' in data:
            ent.natural.fecha_nacimiento = data['fecha_nacimiento'] or None

    if 'id_cargo' in data:
        emp.id_cargo = data['id_cargo'] or None

    if 'estado' in data:
        emp.estado = bool(data['estado'])
        ent.estado = bool(data['estado'])

    if 'especialidades' in data:
        _set_especialidades(emp.id, data['especialidades'])

    if 'telefonos' in data:
        _set_telefonos(ent.id, data['telefonos'])

    db.session.commit()
    log('ACTUALIZAR_EMPLEADO', f"Empleado {id_emp} actualizado",
        id_usuario=id_usuario, modulo='empleados')
    return jsonify(_serializar(emp))


@bp.delete('/<int:id_emp>')
@jwt_required()
@requiere_permiso('gestionar_empleados')
def desactivar(id_emp):
    emp = db.get_or_404(Empleado, id_emp)
    if emp.usuario and emp.usuario.estado:
        return jsonify({
            'error': 'No se puede desactivar un empleado con usuario activo. '
                     'Desactivá primero el usuario del sistema.'
        }), 409
    emp.estado = False
    emp.entidad.estado = False
    db.session.commit()
    id_usuario = int(get_jwt_identity())
    log('DESACTIVAR_EMPLEADO', f"Empleado {id_emp} desactivado",
        id_usuario=id_usuario, modulo='empleados')
    return jsonify({'mensaje': 'Empleado desactivado'})
