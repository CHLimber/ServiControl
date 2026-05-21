from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required
from ..models.catalogo import TipoDocumento, Municipio, TipoEstablecimiento, TipoSistema, Servicio, Categoria, Especialidad
from ..models.proveedor import Proveedor
from ..models.entidad import Empleado, Entidad

bp = Blueprint('catalogos', __name__)


@bp.get('/tipos-documento')
@jwt_required()
def tipos_documento():
    return jsonify([{'id': t.id, 'nombre': t.nombre}
                    for t in TipoDocumento.query.all()])


@bp.get('/municipios')
@jwt_required()
def municipios():
    return jsonify([{'id': m.id, 'nombre': m.nombre}
                    for m in Municipio.query.order_by(Municipio.nombre).all()])


@bp.get('/tipos-establecimiento')
@jwt_required()
def tipos_establecimiento():
    return jsonify([{'id': t.id, 'nombre': t.nombre}
                    for t in TipoEstablecimiento.query.all()])


@bp.get('/tipos-sistema')
@jwt_required()
def tipos_sistema():
    return jsonify([{'id': t.id, 'nombre': t.nombre}
                    for t in TipoSistema.query.all()])


@bp.get('/servicios')
@jwt_required()
def servicios():
    return jsonify([{
        'id': s.id,
        'nombre': s.nombre,
        'precio': float(s.precio)
    } for s in Servicio.query.all()])


@bp.get('/categorias')
@jwt_required()
def categorias():
    return jsonify([{'id': c.id, 'nombre': c.nombre}
                    for c in Categoria.query.filter_by(estado=True).all()])


@bp.get('/especialidades')
@jwt_required()
def especialidades():
    return jsonify([{'id': e.id, 'nombre': e.nombre}
                    for e in Especialidad.query.all()])


@bp.get('/proveedores')
@jwt_required()
def proveedores():
    return jsonify([{
        'id': p.id,
        'nombre': p.nombre,
        'email': p.email,
    } for p in Proveedor.query.filter_by(estado=True).order_by(Proveedor.nombre).all()])


@bp.get('/sistemas')
@jwt_required()
def sistemas():
    from ..models.entidad import Sistema, Establecimiento, Entidad
    sis = (Sistema.query
           .join(Establecimiento, Sistema.id_establecimiento == Establecimiento.id)
           .join(Entidad, Establecimiento.id_entidad == Entidad.id)
           .filter(Sistema.estado == True)
           .order_by(Entidad.nombre, Sistema.nombre)
           .all())
    return jsonify([{
        'id': s.id,
        'nombre': s.nombre or f'Sistema #{s.id}',
        'id_establecimiento': s.id_establecimiento,
    } for s in sis])


@bp.get('/empleados')
@jwt_required()
def empleados():
    emps = (Empleado.query
            .join(Entidad, Empleado.id_entidad == Entidad.id)
            .filter(Empleado.estado == True)
            .order_by(Entidad.nombre)
            .all())
    return jsonify([{
        'id': e.id,
        'nombre': e.entidad.nombre if e.entidad else f'Empleado #{e.id}',
    } for e in emps])
