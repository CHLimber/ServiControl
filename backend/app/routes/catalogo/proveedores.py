from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy import text
from ...extensions import db
from ...models.catalogo.proveedor import Proveedor, DEPARTAMENTOS
from ...models.catalogo.catalogo import Telefono
from ...utils.bitacora import log
from ...utils.permisos import requiere_permiso

bp = Blueprint('proveedores', __name__)


def _get_telefonos(id_proveedor):
    rows = db.session.execute(
        text(
            "SELECT t.id, t.numero FROM telefono t "
            "JOIN telefono_proveedor tp ON t.id = tp.id_telefono "
            "WHERE tp.id_proveedor = :id"
        ),
        {'id': id_proveedor},
    ).fetchall()
    return [{'id': r[0], 'numero': r[1]} for r in rows]


def _set_telefonos(id_proveedor, numeros):
    existing = db.session.execute(
        text("SELECT id_telefono FROM telefono_proveedor WHERE id_proveedor = :id"),
        {'id': id_proveedor},
    ).fetchall()
    old_ids = [r[0] for r in existing]

    db.session.execute(
        text("DELETE FROM telefono_proveedor WHERE id_proveedor = :id"),
        {'id': id_proveedor},
    )
    db.session.flush()

    for tid in old_ids:
        en_entidad = db.session.execute(
            text("SELECT COUNT(*) FROM telefono_entidad WHERE id_telefono = :id"),
            {'id': tid},
        ).scalar()
        if not en_entidad:
            db.session.execute(text("DELETE FROM telefono WHERE id = :id"), {'id': tid})
    db.session.flush()

    for numero in numeros:
        numero = (numero or '').strip()
        if numero:
            tel = Telefono(numero=numero)
            db.session.add(tel)
            db.session.flush()
            db.session.execute(
                text(
                    "INSERT INTO telefono_proveedor (id_telefono, id_proveedor) "
                    "VALUES (:tid, :pid)"
                ),
                {'tid': tel.id, 'pid': id_proveedor},
            )


def _serializar(p: Proveedor) -> dict:
    return {
        'id': p.id,
        'nombre': p.nombre,
        'email': p.email,
        'direccion': p.direccion,
        'departamento': p.departamento,
        'estado': p.estado,
        'fecha_registro': p.fecha_registro.isoformat() if p.fecha_registro else None,
        'telefonos': _get_telefonos(p.id),
    }


@bp.get('/')
@jwt_required()
@requiere_permiso('gestionar_catalogo')
def listar():
    todos = request.args.get('todos') == '1'
    q = Proveedor.query
    if not todos:
        q = q.filter_by(estado=True)
    return jsonify([_serializar(p) for p in q.order_by(Proveedor.nombre).all()])


@bp.get('/<int:id_proveedor>')
@jwt_required()
@requiere_permiso('gestionar_catalogo')
def obtener(id_proveedor):
    p = db.get_or_404(Proveedor, id_proveedor)
    return jsonify(_serializar(p))


@bp.post('/')
@jwt_required()
@requiere_permiso('gestionar_catalogo')
def crear():
    data = request.get_json()
    usuario = get_jwt_identity()

    nombre = (data.get('nombre') or '').strip()
    if not nombre:
        return jsonify({'error': 'El nombre del proveedor es requerido'}), 400

    if Proveedor.query.filter(
        db.func.lower(Proveedor.nombre) == nombre.lower()
    ).first():
        return jsonify({'error': 'Ya existe un proveedor con ese nombre'}), 409

    departamento = data.get('departamento') or None
    if departamento and departamento not in DEPARTAMENTOS:
        return jsonify({'error': 'Departamento no válido'}), 400

    proveedor = Proveedor(
        nombre=nombre,
        email=(data.get('email') or '').strip() or None,
        direccion=(data.get('direccion') or '').strip() or None,
        departamento=departamento,
    )
    db.session.add(proveedor)
    db.session.flush()

    telefonos = data.get('telefonos', [])
    if telefonos:
        _set_telefonos(proveedor.id, telefonos)

    db.session.commit()
    log('CREAR_PROVEEDOR', f"Proveedor '{proveedor.nombre}' creado",
        id_usuario=int(usuario), modulo='proveedores')
    return jsonify(_serializar(proveedor)), 201


@bp.put('/<int:id_proveedor>')
@jwt_required()
@requiere_permiso('gestionar_catalogo')
def actualizar(id_proveedor):
    p = db.get_or_404(Proveedor, id_proveedor)
    data = request.get_json()
    usuario = get_jwt_identity()

    if 'nombre' in data:
        nombre = (data['nombre'] or '').strip()
        if not nombre:
            return jsonify({'error': 'El nombre no puede estar vacío'}), 400
        existente = Proveedor.query.filter(
            db.func.lower(Proveedor.nombre) == nombre.lower(),
            Proveedor.id != id_proveedor,
        ).first()
        if existente:
            return jsonify({'error': 'Ya existe un proveedor con ese nombre'}), 409
        p.nombre = nombre

    if 'email' in data:
        p.email = (data['email'] or '').strip() or None
    if 'direccion' in data:
        p.direccion = (data['direccion'] or '').strip() or None
    if 'departamento' in data:
        dep = data['departamento'] or None
        if dep and dep not in DEPARTAMENTOS:
            return jsonify({'error': 'Departamento no válido'}), 400
        p.departamento = dep
    if 'estado' in data:
        p.estado = bool(data['estado'])

    if 'telefonos' in data:
        _set_telefonos(id_proveedor, data['telefonos'])

    db.session.commit()
    log('ACTUALIZAR_PROVEEDOR', f"Proveedor {id_proveedor} '{p.nombre}' actualizado",
        id_usuario=int(usuario), modulo='proveedores')
    return jsonify(_serializar(p))


@bp.delete('/<int:id_proveedor>')
@jwt_required()
@requiere_permiso('gestionar_catalogo')
def desactivar(id_proveedor):
    p = db.get_or_404(Proveedor, id_proveedor)
    p.estado = False
    db.session.commit()
    log('DESACTIVAR_PROVEEDOR', f"Proveedor {id_proveedor} '{p.nombre}' desactivado",
        id_usuario=int(get_jwt_identity()), modulo='proveedores')
    return jsonify({'mensaje': 'Proveedor desactivado'})


# ── CU14: Asociar Producto a Proveedor ──────────────────────────

@bp.get('/<int:id_proveedor>/productos')
@jwt_required()
@requiere_permiso('gestionar_catalogo')
def listar_productos(id_proveedor):
    db.get_or_404(Proveedor, id_proveedor)
    rows = db.session.execute(
        text(
            "SELECT pp.id_producto, p.codigo, p.nombre, p.unidad_medida, "
            "       cat.nombre AS categoria, pp.precio_unitario, pp.es_principal, "
            "       pp.fecha_actualizacion "
            "FROM producto_proveedor pp "
            "JOIN producto p   ON pp.id_producto  = p.id "
            "JOIN categoria cat ON p.id_categoria = cat.id "
            "WHERE pp.id_proveedor = :id AND p.estado = TRUE "
            "ORDER BY p.nombre"
        ),
        {'id': id_proveedor},
    ).fetchall()
    return jsonify([{
        'id_producto':        r[0],
        'codigo':             r[1],
        'nombre':             r[2],
        'unidad_medida':      r[3],
        'categoria':          r[4],
        'precio_unitario':    float(r[5]),
        'es_principal':       bool(r[6]),
        'fecha_actualizacion': r[7].isoformat() if r[7] else None,
    } for r in rows])


@bp.post('/<int:id_proveedor>/productos')
@jwt_required()
@requiere_permiso('gestionar_catalogo')
def agregar_producto(id_proveedor):
    from ...models.catalogo.producto import Producto
    proveedor = db.get_or_404(Proveedor, id_proveedor)
    data = request.get_json()
    usuario = get_jwt_identity()

    id_producto = data.get('id_producto')
    precio = data.get('precio_unitario')
    es_principal = bool(data.get('es_principal', False))

    if not id_producto:
        return jsonify({'error': 'id_producto es requerido'}), 400
    try:
        precio_f = float(precio)
        if precio_f <= 0:
            raise ValueError
    except (TypeError, ValueError):
        return jsonify({'error': 'El precio debe ser un número mayor a cero'}), 400

    producto = db.session.get(Producto, id_producto)
    if not producto or not producto.estado:
        return jsonify({'error': 'Producto no encontrado o inactivo'}), 404

    existente = db.session.execute(
        text("SELECT COUNT(*) FROM producto_proveedor "
             "WHERE id_producto = :pid AND id_proveedor = :vid"),
        {'pid': id_producto, 'vid': id_proveedor},
    ).scalar()
    if existente:
        return jsonify({'error': 'Este producto ya está asociado a este proveedor'}), 409

    db.session.execute(
        text("INSERT INTO producto_proveedor "
             "(id_producto, id_proveedor, precio_unitario, es_principal) "
             "VALUES (:pid, :vid, :precio, :principal)"),
        {'pid': id_producto, 'vid': id_proveedor, 'precio': precio_f, 'principal': es_principal},
    )
    db.session.commit()

    cat = db.session.execute(
        text("SELECT nombre FROM categoria WHERE id = :id"),
        {'id': producto.id_categoria},
    ).scalar()
    log('ASOCIAR_PRODUCTO_PROVEEDOR',
        f"Producto '{producto.nombre}' asociado a '{proveedor.nombre}' a Bs {precio_f:.2f}",
        id_usuario=int(usuario), modulo='proveedores')
    return jsonify({
        'id_producto':     producto.id,
        'codigo':          producto.codigo,
        'nombre':          producto.nombre,
        'unidad_medida':   producto.unidad_medida,
        'categoria':       cat or '—',
        'precio_unitario': precio_f,
        'es_principal':    es_principal,
        'fecha_actualizacion': None,
    }), 201


@bp.put('/<int:id_proveedor>/productos/<int:id_producto>')
@jwt_required()
@requiere_permiso('gestionar_catalogo')
def actualizar_producto(id_proveedor, id_producto):
    from ...models.catalogo.producto import Producto
    proveedor = db.get_or_404(Proveedor, id_proveedor)
    data = request.get_json()
    usuario = get_jwt_identity()

    fila = db.session.execute(
        text("SELECT precio_unitario, es_principal FROM producto_proveedor "
             "WHERE id_producto = :pid AND id_proveedor = :vid"),
        {'pid': id_producto, 'vid': id_proveedor},
    ).fetchone()
    if not fila:
        return jsonify({'error': 'Asociación no encontrada'}), 404

    precio = float(data.get('precio_unitario', fila[0]))
    if precio <= 0:
        return jsonify({'error': 'El precio debe ser mayor a cero'}), 400
    es_principal = bool(data.get('es_principal', fila[1]))

    db.session.execute(
        text("UPDATE producto_proveedor "
             "SET precio_unitario = :precio, es_principal = :principal "
             "WHERE id_producto = :pid AND id_proveedor = :vid"),
        {'precio': precio, 'principal': es_principal, 'pid': id_producto, 'vid': id_proveedor},
    )
    db.session.commit()

    producto = db.session.get(Producto, id_producto)
    log('ACTUALIZAR_PRODUCTO_PROVEEDOR',
        f"Precio de '{producto.nombre if producto else id_producto}' "
        f"en '{proveedor.nombre}' actualizado a Bs {precio:.2f}",
        id_usuario=int(usuario), modulo='proveedores')
    return jsonify({
        'id_producto':     id_producto,
        'nombre':          producto.nombre if producto else f'Producto #{id_producto}',
        'precio_unitario': precio,
        'es_principal':    es_principal,
    })


@bp.delete('/<int:id_proveedor>/productos/<int:id_producto>')
@jwt_required()
@requiere_permiso('gestionar_catalogo')
def quitar_producto(id_proveedor, id_producto):
    from ...models.catalogo.producto import Producto
    proveedor = db.get_or_404(Proveedor, id_proveedor)
    usuario = get_jwt_identity()

    resultado = db.session.execute(
        text("DELETE FROM producto_proveedor "
             "WHERE id_producto = :pid AND id_proveedor = :vid"),
        {'pid': id_producto, 'vid': id_proveedor},
    )
    if resultado.rowcount == 0:
        db.session.rollback()
        return jsonify({'error': 'Asociación no encontrada'}), 404

    db.session.commit()
    producto = db.session.get(Producto, id_producto)
    log('QUITAR_PRODUCTO_PROVEEDOR',
        f"Producto '{producto.nombre if producto else id_producto}' "
        f"desvinculado de '{proveedor.nombre}'",
        id_usuario=int(usuario), modulo='proveedores')
    return jsonify({'mensaje': 'Asociación eliminada'})
