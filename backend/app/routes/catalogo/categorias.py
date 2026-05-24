from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from ...extensions import db
from ...models.catalogo.catalogo import Categoria
from ...models.catalogo.producto import Producto
from ...utils.bitacora import log
from ...utils.permisos import requiere_permiso

bp = Blueprint('categorias', __name__)


def _serializar(c: Categoria, con_conteo: bool = True) -> dict:
    data = {
        'id': c.id,
        'nombre': c.nombre,
        'descripcion': c.descripcion,
        'estado': c.estado,
    }
    if con_conteo:
        data['total_productos'] = Producto.query.filter_by(
            id_categoria=c.id, estado=True
        ).count()
    return data


@bp.get('/')
@jwt_required()
@requiere_permiso('gestionar_catalogo')
def listar():
    todas = request.args.get('todas') == '1'
    q = Categoria.query
    if not todas:
        q = q.filter_by(estado=True)
    return jsonify([
        _serializar(c)
        for c in q.order_by(Categoria.nombre).all()
    ])


@bp.get('/<int:id_categoria>')
@jwt_required()
@requiere_permiso('gestionar_catalogo')
def obtener(id_categoria):
    c = db.get_or_404(Categoria, id_categoria)
    return jsonify(_serializar(c))


@bp.post('/')
@jwt_required()
@requiere_permiso('gestionar_catalogo')
def crear():
    data = request.get_json()
    usuario = get_jwt_identity()

    nombre = (data.get('nombre') or '').strip()
    if not nombre:
        return jsonify({'error': 'El nombre de la categoría es requerido'}), 400

    if Categoria.query.filter(
        db.func.lower(Categoria.nombre) == nombre.lower()
    ).first():
        return jsonify({'error': 'Ya existe una categoría con ese nombre'}), 409

    cat = Categoria(
        nombre=nombre,
        descripcion=(data.get('descripcion') or '').strip() or None,
    )
    db.session.add(cat)
    db.session.commit()

    log('CREAR_CATEGORIA', f"Categoría '{cat.nombre}' creada",
        id_usuario=int(usuario), modulo='categorias')
    return jsonify(_serializar(cat)), 201


@bp.put('/<int:id_categoria>')
@jwt_required()
@requiere_permiso('gestionar_catalogo')
def actualizar(id_categoria):
    cat = db.get_or_404(Categoria, id_categoria)
    data = request.get_json()
    usuario = get_jwt_identity()

    if 'nombre' in data:
        nombre = (data['nombre'] or '').strip()
        if not nombre:
            return jsonify({'error': 'El nombre no puede estar vacío'}), 400
        existente = Categoria.query.filter(
            db.func.lower(Categoria.nombre) == nombre.lower(),
            Categoria.id != id_categoria,
        ).first()
        if existente:
            return jsonify({'error': 'Ya existe una categoría con ese nombre'}), 409
        cat.nombre = nombre

    if 'descripcion' in data:
        cat.descripcion = (data['descripcion'] or '').strip() or None

    db.session.commit()
    log('ACTUALIZAR_CATEGORIA', f"Categoría {id_categoria} '{cat.nombre}' actualizada",
        id_usuario=int(usuario), modulo='categorias')
    return jsonify(_serializar(cat))


@bp.delete('/<int:id_categoria>')
@jwt_required()
@requiere_permiso('gestionar_catalogo')
def desactivar(id_categoria):
    cat = db.get_or_404(Categoria, id_categoria)
    usuario = get_jwt_identity()

    productos_activos = Producto.query.filter_by(
        id_categoria=id_categoria, estado=True
    ).count()
    if productos_activos > 0:
        return jsonify({
            'error': f'La categoría tiene {productos_activos} producto(s) activo(s). '
                     'Desactivalos primero antes de desactivar la categoría.'
        }), 409

    cat.estado = False
    db.session.commit()
    log('DESACTIVAR_CATEGORIA', f"Categoría {id_categoria} '{cat.nombre}' desactivada",
        id_usuario=int(usuario), modulo='categorias')
    return jsonify({'mensaje': 'Categoría desactivada'})
