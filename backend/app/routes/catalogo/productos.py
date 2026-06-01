from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy import text
from ...extensions import db
from ...models.catalogo.producto import Producto
from ...models.catalogo.catalogo import Categoria
from ...utils.bitacora import log
from ...utils.permisos import requiere_permiso

bp = Blueprint('productos', __name__)


@bp.get('/')
@jwt_required()
@requiere_permiso('gestionar_catalogo')
def listar():
    productos = Producto.query.filter_by(estado=True).order_by(Producto.nombre).all()
    return jsonify([_serializar(p) for p in productos])


@bp.get('/precios-proveedores')
@jwt_required()
@requiere_permiso('gestionar_catalogo')
def precios_proveedores():
    """Devuelve todas las relaciones producto-proveedor con su precio fijo.
    Usado por cotizaciones para autollenar precios y filtrar proveedores válidos."""
    rows = db.session.execute(
        text(
            "SELECT pp.id_producto, pp.id_proveedor, pp.precio_unitario, pp.es_principal "
            "FROM producto_proveedor pp "
            "JOIN producto p   ON pp.id_producto  = p.id "
            "JOIN proveedor pv ON pp.id_proveedor = pv.id "
            "WHERE p.estado = TRUE AND pv.estado = TRUE"
        )
    ).fetchall()
    return jsonify([{
        'id_producto':     r[0],
        'id_proveedor':    r[1],
        'precio_unitario': float(r[2]),
        'es_principal':    bool(r[3]),
    } for r in rows])


@bp.get('/<int:id_producto>/proveedores')
@jwt_required()
@requiere_permiso('gestionar_catalogo')
def proveedores_de_producto(id_producto):
    """Lista proveedores activos que ofrecen este producto, con su precio."""
    db.get_or_404(Producto, id_producto)
    rows = db.session.execute(
        text(
            "SELECT pp.id_proveedor, pv.nombre, pp.precio_unitario, pp.es_principal, "
            "       pp.fecha_actualizacion "
            "FROM producto_proveedor pp "
            "JOIN proveedor pv ON pp.id_proveedor = pv.id "
            "WHERE pp.id_producto = :id AND pv.estado = TRUE "
            "ORDER BY pp.es_principal DESC, pv.nombre"
        ),
        {'id': id_producto},
    ).fetchall()
    return jsonify([{
        'id_proveedor':        r[0],
        'nombre':              r[1],
        'precio_unitario':     float(r[2]),
        'es_principal':        bool(r[3]),
        'fecha_actualizacion': r[4].isoformat() if r[4] else None,
    } for r in rows])


@bp.get('/<int:id_producto>')
@jwt_required()
@requiere_permiso('gestionar_catalogo')
def obtener(id_producto):
    p = db.get_or_404(Producto, id_producto)
    return jsonify(_serializar(p))


@bp.post('/')
@jwt_required()
@requiere_permiso('gestionar_catalogo')
def crear():
    data = request.get_json()
    usuario = get_jwt_identity()

    campos_requeridos = ['codigo', 'nombre', 'unidad_medida', 'id_categoria']
    for campo in campos_requeridos:
        if not data.get(campo):
            return jsonify({'error': f'El campo {campo} es requerido'}), 400

    if Producto.query.filter_by(codigo=data['codigo']).first():
        return jsonify({'error': 'Ya existe un producto con ese código'}), 409

    if not Categoria.query.filter_by(id=data['id_categoria'], estado=True).first():
        return jsonify({'error': 'Categoría no válida'}), 400

    producto = Producto(
        codigo=data['codigo'].strip().upper(),
        nombre=data['nombre'].strip(),
        unidad_medida=data['unidad_medida'].strip(),
        id_categoria=data['id_categoria'],
        descripcion=data.get('descripcion', '').strip() or None,
    )
    db.session.add(producto)
    db.session.commit()
    log('CREAR_PRODUCTO', f"Producto '{producto.nombre}' (cod: {producto.codigo}) creado",
        id_usuario=int(usuario), modulo='productos')
    return jsonify(_serializar(producto)), 201


@bp.put('/<int:id_producto>')
@jwt_required()
@requiere_permiso('gestionar_catalogo')
def actualizar(id_producto):
    p = db.get_or_404(Producto, id_producto)
    data = request.get_json()
    usuario = get_jwt_identity()

    if 'codigo' in data:
        codigo_nuevo = data['codigo'].strip().upper()
        existente = Producto.query.filter_by(codigo=codigo_nuevo).first()
        if existente and existente.id != id_producto:
            return jsonify({'error': 'Ya existe un producto con ese código'}), 409
        p.codigo = codigo_nuevo

    if 'nombre' in data:
        p.nombre = data['nombre'].strip()
    if 'unidad_medida' in data:
        p.unidad_medida = data['unidad_medida'].strip()
    if 'descripcion' in data:
        p.descripcion = data['descripcion'].strip() or None
    if 'id_categoria' in data:
        if not Categoria.query.filter_by(id=data['id_categoria'], estado=True).first():
            return jsonify({'error': 'Categoría no válida'}), 400
        p.id_categoria = data['id_categoria']

    db.session.commit()
    log('ACTUALIZAR_PRODUCTO', f"Producto '{p.nombre}' (cod:{p.codigo}) actualizado",
        id_usuario=int(usuario), modulo='productos')
    return jsonify(_serializar(p))


@bp.delete('/<int:id_producto>')
@jwt_required()
@requiere_permiso('gestionar_catalogo')
def desactivar(id_producto):
    p = db.get_or_404(Producto, id_producto)
    nombre = p.nombre
    p.estado = False
    db.session.commit()
    usuario = get_jwt_identity()
    log('DESACTIVAR_PRODUCTO', f"Producto '{nombre}' (id:{id_producto}) desactivado",
        id_usuario=int(usuario), modulo='productos')
    return jsonify({'mensaje': 'Producto desactivado'})


def _serializar(p: Producto) -> dict:
    return {
        'id': p.id,
        'codigo': p.codigo,
        'nombre': p.nombre,
        'unidad_medida': p.unidad_medida,
        'descripcion': p.descripcion,
        'id_categoria': p.id_categoria,
        'estado': p.estado,
    }
