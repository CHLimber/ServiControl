import json
from datetime import date, datetime
from decimal import Decimal

from flask import Blueprint, current_app, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity

from ...extensions import db
from ...models.seguridad.auth import Usuario, Permiso, RolPermiso
from ...utils.bitacora import log
from ...utils.timezone import ahora_bolivia

bp = Blueprint('asistente', __name__)

ROL_ADMIN      = 'Administrador'
MAX_ITERACIONES = 6
MAX_TOKENS      = 1500
LIMITE_FILAS    = 30

# ── Permisos por módulo ────────────────────────────────────────────────────
MODULOS = {
    'finanzas':      ('asistente_finanzas',),
    'proyectos':     ('asistente_proyectos',),
    'ordenes':       ('asistente_ordenes',),
    'cotizaciones':  ('asistente_cotizaciones',),
    'clientes':      ('asistente_clientes',),
    'mantenimiento': ('asistente_mantenimientos',),
    'catalogo':      ('asistente_catalogo',),
    'empleados':     ('asistente_empleados',),
}

MODULOS_LABEL = {
    'finanzas':      'Finanzas (pagos, gastos, cuentas por cobrar)',
    'proyectos':     'Proyectos',
    'ordenes':       'Órdenes de trabajo',
    'cotizaciones':  'Cotizaciones',
    'clientes':      'Clientes',
    'mantenimiento': 'Mantenimiento',
    'catalogo':      'Catálogo (productos, proveedores, precios)',
    'empleados':     'Empleados',
}


# ── Helpers de serialización ───────────────────────────────────────────────
def _val(v):
    if isinstance(v, Decimal):
        return float(v)
    if isinstance(v, (date, datetime)):
        return v.isoformat()
    return v


def _dias_desde(f):
    if not f:
        return None
    hoy = ahora_bolivia().date()
    if isinstance(f, datetime):
        f = f.date()
    return (hoy - f).days


# ── Herramientas de consulta (solo lectura) ────────────────────────────────

def _finanzas_pagos_por_cliente(args):
    from ...models.finanzas.finanzas import Pago
    from ...models.proyectos.proyecto import Proyecto
    from ...models.entidades.entidad import Entidad

    q = (db.session.query(Pago, Proyecto, Entidad)
         .join(Proyecto, Proyecto.id == Pago.id_proyecto)
         .join(Entidad, Entidad.id == Proyecto.id_entidad))
    cliente = (args.get('cliente') or '').strip()
    if cliente:
        q = q.filter(Entidad.nombre.ilike(f'%{cliente}%'))
    if args.get('fecha_inicio'):
        q = q.filter(Pago.fecha_pago >= args['fecha_inicio'])
    if args.get('fecha_fin'):
        q = q.filter(Pago.fecha_pago <= args['fecha_fin'])

    por_cliente = {}
    for pago, proy, ent in q.all():
        d = por_cliente.setdefault(ent.nombre, {
            'cliente': ent.nombre, 'total_pagado': 0.0,
            'cantidad_pagos': 0, 'ultimo_pago': None,
        })
        d['total_pagado'] += float(pago.monto)
        d['cantidad_pagos'] += 1
        if pago.fecha_pago and (d['ultimo_pago'] is None or pago.fecha_pago.isoformat() > d['ultimo_pago']):
            d['ultimo_pago'] = pago.fecha_pago.isoformat()
    filas = list(por_cliente.values())
    for d in filas:
        d['dias_desde_ultimo_pago'] = _dias_desde(
            date.fromisoformat(d['ultimo_pago']) if d['ultimo_pago'] else None)
        d['total_pagado'] = round(d['total_pagado'], 2)
    filas.sort(key=lambda x: (x['dias_desde_ultimo_pago'] or 0), reverse=True)
    return {'clientes': filas[:LIMITE_FILAS]}


def _finanzas_pagos_detalle(args):
    from ...models.finanzas.finanzas import Pago
    from ...models.proyectos.proyecto import Proyecto
    from ...models.entidades.entidad import Entidad

    q = (db.session.query(Pago, Proyecto, Entidad)
         .join(Proyecto, Proyecto.id == Pago.id_proyecto)
         .join(Entidad, Entidad.id == Proyecto.id_entidad))
    if args.get('cliente'):
        q = q.filter(Entidad.nombre.ilike(f"%{args['cliente'].strip()}%"))
    if args.get('codigo_proyecto'):
        q = q.filter(Proyecto.codigo == args['codigo_proyecto'].strip())
    if args.get('fecha_inicio'):
        q = q.filter(Pago.fecha_pago >= args['fecha_inicio'])
    if args.get('fecha_fin'):
        q = q.filter(Pago.fecha_pago <= args['fecha_fin'])

    filas, total = [], 0.0
    for pago, proy, ent in q.order_by(Pago.fecha_pago.desc()).limit(LIMITE_FILAS).all():
        total += float(pago.monto)
        filas.append({
            'fecha': _val(pago.fecha_pago), 'cliente': ent.nombre,
            'proyecto': proy.codigo, 'tipo_pago': pago.tipo_pago,
            'metodo': pago.metodo, 'monto': _val(pago.monto),
            'observacion': pago.observacion,
        })
    return {'pagos': filas, 'cantidad': len(filas), 'total_mostrado': round(total, 2)}


def _finanzas_gastos(args):
    from ...models.finanzas.finanzas import GastoOrden
    from ...models.ordenes.orden import OrdenTrabajo
    from ...models.proyectos.proyecto import Proyecto

    q = (db.session.query(GastoOrden, OrdenTrabajo, Proyecto)
         .join(OrdenTrabajo, OrdenTrabajo.id == GastoOrden.id_orden)
         .join(Proyecto, Proyecto.id == OrdenTrabajo.id_proyecto))
    if args.get('codigo_orden'):
        q = q.filter(OrdenTrabajo.codigo == args['codigo_orden'].strip())
    if args.get('codigo_proyecto'):
        q = q.filter(Proyecto.codigo == args['codigo_proyecto'].strip())
    if args.get('concepto'):
        q = q.filter(GastoOrden.concepto == args['concepto'])

    filas, total = [], 0.0
    for gasto, orden, proy in q.order_by(GastoOrden.fecha_gasto.desc()).limit(LIMITE_FILAS).all():
        total += float(gasto.monto)
        filas.append({
            'orden': orden.codigo, 'proyecto': proy.codigo,
            'concepto': gasto.concepto, 'descripcion': gasto.descripcion,
            'monto': _val(gasto.monto), 'fecha': _val(gasto.fecha_gasto),
        })
    return {'gastos': filas, 'total_mostrado': round(total, 2)}


def _proyectos_buscar(args):
    from ...models.proyectos.proyecto import Proyecto, EstadoProyecto
    from ...models.entidades.entidad import Entidad

    q = (db.session.query(Proyecto, EstadoProyecto, Entidad)
         .join(EstadoProyecto, EstadoProyecto.id == Proyecto.id_estado_proyecto)
         .join(Entidad, Entidad.id == Proyecto.id_entidad))
    if args.get('cliente'):
        q = q.filter(Entidad.nombre.ilike(f"%{args['cliente'].strip()}%"))
    if args.get('codigo'):
        q = q.filter(Proyecto.codigo.ilike(f"%{args['codigo'].strip()}%"))
    if args.get('estado'):
        q = q.filter(EstadoProyecto.nombre.ilike(f"%{args['estado'].strip()}%"))
    if args.get('texto'):
        q = q.filter(Proyecto.titulo.ilike(f"%{args['texto'].strip()}%"))

    filas = []
    for proy, est, ent in q.order_by(Proyecto.fecha_creacion.desc()).limit(LIMITE_FILAS).all():
        filas.append({
            'codigo': proy.codigo, 'titulo': proy.titulo, 'cliente': ent.nombre,
            'estado': est.nombre, 'fecha_inicio': _val(proy.fecha_inicio),
            'fecha_fin': _val(proy.fecha_fin),
        })
    return {'proyectos': filas}


def _proyecto_detalle(args):
    from ...models.proyectos.proyecto import Proyecto, EstadoProyecto
    from ...models.entidades.entidad import Entidad
    from ...models.ordenes.orden import OrdenTrabajo, EstadoOrden

    codigo = (args.get('codigo') or '').strip()
    row = (db.session.query(Proyecto, EstadoProyecto, Entidad)
           .join(EstadoProyecto, EstadoProyecto.id == Proyecto.id_estado_proyecto)
           .join(Entidad, Entidad.id == Proyecto.id_entidad)
           .filter(Proyecto.codigo == codigo).first())
    if not row:
        return {'error': f'No se encontró un proyecto con código {codigo}'}
    proy, est, ent = row

    ordenes = []
    for orden, eo in (db.session.query(OrdenTrabajo, EstadoOrden)
                      .join(EstadoOrden, EstadoOrden.id == OrdenTrabajo.id_estado_orden)
                      .filter(OrdenTrabajo.id_proyecto == proy.id).all()):
        ordenes.append({'codigo': orden.codigo, 'estado': eo.nombre,
                        'fecha_ejecucion': _val(orden.fecha_ejecucion)})
    return {
        'codigo': proy.codigo, 'titulo': proy.titulo, 'cliente': ent.nombre,
        'estado': est.nombre, 'descripcion': proy.descripcion,
        'fecha_inicio': _val(proy.fecha_inicio), 'fecha_fin': _val(proy.fecha_fin),
        'ordenes': ordenes,
    }


def _orden_detalle(args):
    from ...models.ordenes.orden import OrdenTrabajo, EstadoOrden, OrdenProducto, OrdenEmpleado
    from ...models.catalogo.producto import Producto
    from ...models.entidades.entidad import Empleado, Entidad
    from ...models.finanzas.finanzas import GastoOrden

    codigo = (args.get('codigo') or '').strip()
    row = (db.session.query(OrdenTrabajo, EstadoOrden)
           .join(EstadoOrden, EstadoOrden.id == OrdenTrabajo.id_estado_orden)
           .filter(OrdenTrabajo.codigo == codigo).first())
    if not row:
        return {'error': f'No se encontró una orden con código {codigo}'}
    orden, eo = row

    productos = []
    for op, prod in (db.session.query(OrdenProducto, Producto)
                     .join(Producto, Producto.id == OrdenProducto.id_producto)
                     .filter(OrdenProducto.id_orden_trabajo == orden.id).all()):
        productos.append({
            'producto': prod.nombre, 'codigo': prod.codigo,
            'unidad': prod.unidad_medida,
            'cantidad_asignada': _val(op.cantidad_asignada),
            'cantidad_usada': _val(op.cantidad_usada),
        })

    empleados = []
    for oe, emp, ent in (db.session.query(OrdenEmpleado, Empleado, Entidad)
                         .join(Empleado, Empleado.id == OrdenEmpleado.id_empleado)
                         .join(Entidad, Entidad.id == Empleado.id_entidad)
                         .filter(OrdenEmpleado.id_orden_trabajo == orden.id).all()):
        empleados.append({'nombre': ent.nombre, 'responsable': bool(oe.es_responsable)})

    gastos = GastoOrden.query.filter_by(id_orden=orden.id).all()
    return {
        'codigo': orden.codigo, 'estado': eo.nombre,
        'descripcion': orden.descripcion, 'observaciones': orden.observaciones,
        'fecha_ejecucion': _val(orden.fecha_ejecucion),
        'productos': productos, 'empleados': empleados,
        'total_gastos': round(sum(float(g.monto) for g in gastos), 2),
    }


def _cotizaciones_buscar(args):
    from ...models.cotizaciones.cotizacion import Cotizacion
    from ...models.entidades.entidad import Entidad

    q = (db.session.query(Cotizacion, Entidad)
         .join(Entidad, Entidad.id == Cotizacion.id_entidad))
    if args.get('cliente'):
        q = q.filter(Entidad.nombre.ilike(f"%{args['cliente'].strip()}%"))
    if args.get('estado'):
        q = q.filter(Cotizacion.estado == args['estado'])
    if args.get('codigo'):
        q = q.filter(Cotizacion.codigo.ilike(f"%{args['codigo'].strip()}%"))

    filas = []
    for cot, ent in q.order_by(Cotizacion.fecha_creacion.desc()).limit(LIMITE_FILAS).all():
        total = float(cot.subtotal_productos or 0) + float(cot.mano_de_obra or 0)
        filas.append({
            'codigo': cot.codigo, 'cliente': ent.nombre, 'estado': cot.estado,
            'subtotal_productos': _val(cot.subtotal_productos),
            'mano_de_obra': _val(cot.mano_de_obra), 'total': round(total, 2),
            'fecha': _val(cot.fecha_creacion),
        })
    return {'cotizaciones': filas}


def _cotizacion_detalle(args):
    from ...models.cotizaciones.cotizacion import Cotizacion, CotizacionDetalle
    from ...models.catalogo.producto import Producto
    from ...models.catalogo.proveedor import Proveedor

    codigo = (args.get('codigo') or '').strip()
    cot = Cotizacion.query.filter_by(codigo=codigo).first()
    if not cot:
        return {'error': f'No se encontró una cotización con código {codigo}'}

    detalles = []
    for det, prod, prov in (db.session.query(CotizacionDetalle, Producto, Proveedor)
                            .join(Producto, Producto.id == CotizacionDetalle.id_producto)
                            .join(Proveedor, Proveedor.id == CotizacionDetalle.id_proveedor)
                            .filter(CotizacionDetalle.id_cotizacion == cot.id).all()):
        detalles.append({
            'producto': prod.nombre, 'proveedor': prov.nombre,
            'cantidad': _val(det.cantidad), 'precio_unitario': _val(det.precio_unitario),
            'subtotal': _val(det.subtotal),
        })
    return {
        'codigo': cot.codigo, 'estado': cot.estado,
        'subtotal_productos': _val(cot.subtotal_productos),
        'mano_de_obra': _val(cot.mano_de_obra), 'detalles': detalles,
    }


def _clientes_buscar(args):
    from ...models.entidades.entidad import Entidad

    q = Entidad.query.filter(Entidad.cliente.is_(True))
    if args.get('texto'):
        q = q.filter(Entidad.nombre.ilike(f"%{args['texto'].strip()}%"))
    filas = [{'nombre': e.nombre, 'tipo': e.tipo, 'email': e.email, 'activo': bool(e.estado)}
             for e in q.order_by(Entidad.nombre).limit(LIMITE_FILAS).all()]
    return {'clientes': filas}


def _cliente_detalle(args):
    from ...models.entidades.entidad import Entidad
    from ...models.proyectos.proyecto import Proyecto, EstadoProyecto

    nombre = (args.get('nombre') or '').strip()
    ent = Entidad.query.filter(Entidad.cliente.is_(True),
                               Entidad.nombre.ilike(f'%{nombre}%')).first()
    if not ent:
        return {'error': f'No se encontró un cliente que coincida con "{nombre}"'}

    proyectos = []
    for proy, est in (db.session.query(Proyecto, EstadoProyecto)
                      .join(EstadoProyecto, EstadoProyecto.id == Proyecto.id_estado_proyecto)
                      .filter(Proyecto.id_entidad == ent.id).all()):
        proyectos.append({'codigo': proy.codigo, 'titulo': proy.titulo,
                          'estado': est.nombre, 'fecha_fin': _val(proy.fecha_fin)})
    return {
        'nombre': ent.nombre, 'tipo': ent.tipo, 'email': ent.email,
        'activo': bool(ent.estado), 'proyectos': proyectos,
    }


def _productos_buscar(args):
    from ...models.catalogo.producto import Producto
    from ...models.catalogo.catalogo import Categoria

    q = (db.session.query(Producto, Categoria)
         .join(Categoria, Categoria.id == Producto.id_categoria))
    if args.get('texto'):
        q = q.filter(Producto.nombre.ilike(f"%{args['texto'].strip()}%"))
    if args.get('categoria'):
        q = q.filter(Categoria.nombre.ilike(f"%{args['categoria'].strip()}%"))
    filas = [{'codigo': p.codigo, 'nombre': p.nombre, 'categoria': c.nombre,
              'unidad': p.unidad_medida}
             for p, c in q.order_by(Producto.nombre).limit(LIMITE_FILAS).all()]
    return {'productos': filas}


def _producto_precio(args):
    from ...models.catalogo.producto import Producto
    from ...models.catalogo.proveedor import Proveedor
    from ...models.cotizaciones.cotizacion import Cotizacion, CotizacionDetalle

    texto = (args.get('nombre') or '').strip()
    prods = Producto.query.filter(
        db.or_(Producto.nombre.ilike(f'%{texto}%'), Producto.codigo.ilike(f'%{texto}%'))
    ).limit(10).all()
    if not prods:
        return {'error': f'No se encontró un producto que coincida con "{texto}"'}

    resultado = []
    for prod in prods:
        filas = (db.session.query(CotizacionDetalle, Proveedor, Cotizacion)
                 .join(Proveedor, Proveedor.id == CotizacionDetalle.id_proveedor)
                 .join(Cotizacion, Cotizacion.id == CotizacionDetalle.id_cotizacion)
                 .filter(CotizacionDetalle.id_producto == prod.id)
                 .order_by(Cotizacion.fecha_creacion.desc()).all())
        vistos, precios = set(), []
        for det, prov, cot in filas:
            if prov.nombre in vistos:
                continue
            vistos.add(prov.nombre)
            precios.append({'proveedor': prov.nombre,
                            'precio_unitario': _val(det.precio_unitario),
                            'fecha': _val(cot.fecha_creacion)})
        resultado.append({'producto': prod.nombre, 'codigo': prod.codigo,
                          'unidad': prod.unidad_medida, 'precios_recientes': precios[:5]})
    return {'productos': resultado}


def _empleados_buscar(args):
    from ...models.entidades.entidad import Empleado, Entidad
    from ...models.catalogo.catalogo import Cargo

    q = (db.session.query(Empleado, Entidad, Cargo)
         .join(Entidad, Entidad.id == Empleado.id_entidad)
         .outerjoin(Cargo, Cargo.id == Empleado.id_cargo))
    if args.get('nombre'):
        q = q.filter(Entidad.nombre.ilike(f"%{args['nombre'].strip()}%"))
    if args.get('cargo'):
        q = q.filter(Cargo.nombre.ilike(f"%{args['cargo'].strip()}%"))
    if 'activo' in args:
        q = q.filter(Empleado.estado == bool(args['activo']))

    filas = []
    for emp, ent, cargo in q.order_by(Entidad.nombre).limit(LIMITE_FILAS).all():
        filas.append({
            'nombre': ent.nombre, 'cargo': cargo.nombre if cargo else None,
            'email': ent.email, 'activo': bool(emp.estado),
        })
    return {'empleados': filas, 'total': len(filas)}


def _mantenimientos_listar(args):
    from ...models.mantenimiento.mantenimiento import Mantenimiento
    from ...models.entidades.entidad import Sistema

    q = (db.session.query(Mantenimiento, Sistema)
         .join(Sistema, Sistema.id == Mantenimiento.id_sistema))
    if args.get('estado'):
        q = q.filter(Mantenimiento.estado == args['estado'])
    if args.get('tipo'):
        q = q.filter(Mantenimiento.tipo == args['tipo'])
    filas = []
    for mant, sis in q.order_by(Mantenimiento.fecha_programada).limit(LIMITE_FILAS).all():
        filas.append({
            'sistema': sis.nombre, 'tipo': mant.tipo, 'estado': mant.estado,
            'fecha_programada': _val(mant.fecha_programada),
            'dias_para_vencer': (-_dias_desde(mant.fecha_programada)
                                 if mant.fecha_programada else None),
        })
    return {'mantenimientos': filas}


# ── Registro de herramientas ───────────────────────────────────────────────
HERRAMIENTAS = [
    {
        'modulo': 'finanzas', 'funcion': _finanzas_pagos_por_cliente,
        'name': 'finanzas_pagos_por_cliente',
        'description': 'Resumen de pagos agrupado por cliente: total pagado, cantidad de '
                       'pagos, fecha del último pago y días transcurridos desde el último '
                       'pago (útil para detectar clientes que se demoran en pagar). '
                       'Filtros opcionales: cliente (nombre), fecha_inicio, fecha_fin.',
        'input_schema': {
            'type': 'object',
            'properties': {
                'cliente': {'type': 'string', 'description': 'Nombre o parte del nombre del cliente'},
                'fecha_inicio': {'type': 'string', 'description': 'YYYY-MM-DD'},
                'fecha_fin': {'type': 'string', 'description': 'YYYY-MM-DD'},
            },
        },
    },
    {
        'modulo': 'finanzas', 'funcion': _finanzas_pagos_detalle,
        'name': 'finanzas_pagos_detalle',
        'description': 'Lista los pagos INDIVIDUALES (cada pago con su fecha, monto, tipo de '
                       'pago, método y observación). Útil cuando piden el detalle o una tabla '
                       'de pagos, no el resumen. Filtros: cliente (nombre), codigo_proyecto, '
                       'fecha_inicio, fecha_fin (YYYY-MM-DD).',
        'input_schema': {
            'type': 'object',
            'properties': {
                'cliente': {'type': 'string'},
                'codigo_proyecto': {'type': 'string'},
                'fecha_inicio': {'type': 'string', 'description': 'YYYY-MM-DD'},
                'fecha_fin': {'type': 'string', 'description': 'YYYY-MM-DD'},
            },
        },
    },
    {
        'modulo': 'finanzas', 'funcion': _finanzas_gastos,
        'name': 'finanzas_gastos',
        'description': 'Gastos registrados en órdenes de trabajo (materiales, viáticos, '
                       'transporte, otro). Filtros: codigo_orden, codigo_proyecto, concepto.',
        'input_schema': {
            'type': 'object',
            'properties': {
                'codigo_orden': {'type': 'string'},
                'codigo_proyecto': {'type': 'string'},
                'concepto': {'type': 'string', 'enum': ['materiales', 'viaticos', 'transporte', 'otro']},
            },
        },
    },
    {
        'modulo': 'proyectos', 'funcion': _proyectos_buscar,
        'name': 'proyectos_buscar',
        'description': 'Lista proyectos con su estado, cliente y fechas. Filtros opcionales: '
                       'cliente, codigo, estado, texto (en el título).',
        'input_schema': {
            'type': 'object',
            'properties': {
                'cliente': {'type': 'string'}, 'codigo': {'type': 'string'},
                'estado': {'type': 'string'}, 'texto': {'type': 'string'},
            },
        },
    },
    {
        'modulo': 'proyectos', 'funcion': _proyecto_detalle,
        'name': 'proyecto_detalle',
        'description': 'Detalle de un proyecto por su código: estado, cliente, fechas, '
                       'descripción y sus órdenes de trabajo con estado.',
        'input_schema': {
            'type': 'object',
            'properties': {'codigo': {'type': 'string'}},
            'required': ['codigo'],
        },
    },
    {
        'modulo': 'ordenes', 'funcion': _orden_detalle,
        'name': 'orden_detalle',
        'description': 'Detalle de una orden de trabajo por su código: estado, descripción, '
                       'productos usados (cantidad asignada y usada), empleados asignados y '
                       'total de gastos. Útil para estimar costos de materiales de una OT.',
        'input_schema': {
            'type': 'object',
            'properties': {'codigo': {'type': 'string'}},
            'required': ['codigo'],
        },
    },
    {
        'modulo': 'cotizaciones', 'funcion': _cotizaciones_buscar,
        'name': 'cotizaciones_buscar',
        'description': 'Lista cotizaciones con cliente, estado y total. Filtros: cliente, '
                       'estado (borrador, enviada, aprobada, rechazada, vencida, convertida), codigo.',
        'input_schema': {
            'type': 'object',
            'properties': {
                'cliente': {'type': 'string'},
                'estado': {'type': 'string', 'enum': ['borrador', 'enviada', 'aprobada', 'rechazada', 'vencida', 'convertida']},
                'codigo': {'type': 'string'},
            },
        },
    },
    {
        'modulo': 'cotizaciones', 'funcion': _cotizacion_detalle,
        'name': 'cotizacion_detalle',
        'description': 'Detalle de una cotización por código: productos, proveedor, cantidad, '
                       'precio unitario y subtotales.',
        'input_schema': {
            'type': 'object',
            'properties': {'codigo': {'type': 'string'}},
            'required': ['codigo'],
        },
    },
    {
        'modulo': 'clientes', 'funcion': _clientes_buscar,
        'name': 'clientes_buscar',
        'description': 'Busca clientes por nombre. Devuelve nombre, tipo, email y si está activo.',
        'input_schema': {
            'type': 'object',
            'properties': {'texto': {'type': 'string'}},
        },
    },
    {
        'modulo': 'clientes', 'funcion': _cliente_detalle,
        'name': 'cliente_detalle',
        'description': 'Datos de un cliente por nombre, incluyendo la lista de sus proyectos '
                       'con estado.',
        'input_schema': {
            'type': 'object',
            'properties': {'nombre': {'type': 'string'}},
            'required': ['nombre'],
        },
    },
    {
        'modulo': 'catalogo', 'funcion': _productos_buscar,
        'name': 'productos_buscar',
        'description': 'Busca productos del catálogo por nombre o categoría. Devuelve código, '
                       'nombre, categoría y unidad de medida.',
        'input_schema': {
            'type': 'object',
            'properties': {'texto': {'type': 'string'}, 'categoria': {'type': 'string'}},
        },
    },
    {
        'modulo': 'catalogo', 'funcion': _producto_precio,
        'name': 'producto_precio',
        'description': 'Precio más reciente conocido de un producto por proveedor (aproximado '
                       'a partir de cotizaciones, no hay lista de precios maestra). Útil para '
                       'estimar costos de materiales.',
        'input_schema': {
            'type': 'object',
            'properties': {'nombre': {'type': 'string', 'description': 'Nombre o código del producto'}},
            'required': ['nombre'],
        },
    },
    {
        'modulo': 'empleados', 'funcion': _empleados_buscar,
        'name': 'empleados_buscar',
        'description': 'Lista empleados de la empresa con su nombre, cargo y email. '
                       'Filtros opcionales: nombre (texto parcial), cargo (texto parcial), '
                       'activo (true/false).',
        'input_schema': {
            'type': 'object',
            'properties': {
                'nombre': {'type': 'string', 'description': 'Nombre o parte del nombre'},
                'cargo': {'type': 'string', 'description': 'Cargo o parte del nombre del cargo'},
                'activo': {'type': 'boolean', 'description': 'Filtrar por estado activo/inactivo'},
            },
        },
    },
    {
        'modulo': 'mantenimiento', 'funcion': _mantenimientos_listar,
        'name': 'mantenimientos_listar',
        'description': 'Lista mantenimientos programados con su sistema, tipo, estado y días '
                       'para vencer. Filtros: estado (pendiente, confirmado, reprogramado, '
                       'completado, vencido), tipo (preventivo, correctivo).',
        'input_schema': {
            'type': 'object',
            'properties': {
                'estado': {'type': 'string', 'enum': ['pendiente', 'confirmado', 'reprogramado', 'completado', 'vencido']},
                'tipo': {'type': 'string', 'enum': ['preventivo', 'correctivo']},
            },
        },
    },
]

_POR_NOMBRE = {h['name']: h for h in HERRAMIENTAS}


# ── Funciones de acceso ────────────────────────────────────────────────────
def _tiene_acceso(modulo, permisos, es_admin):
    if es_admin:
        return True
    return any(p in permisos for p in MODULOS.get(modulo, ()))


def _herramientas_permitidas(permisos, es_admin):
    return [
        {'name': h['name'], 'description': h['description'], 'input_schema': h['input_schema']}
        for h in HERRAMIENTAS if _tiene_acceso(h['modulo'], permisos, es_admin)
    ]


def _modulos_permitidos(permisos, es_admin):
    return [m for m in MODULOS if _tiene_acceso(m, permisos, es_admin)]


def _modulos_denegados(permisos, es_admin):
    return [m for m in MODULOS if not _tiene_acceso(m, permisos, es_admin)]


def _ejecutar_herramienta(nombre, args, permisos, es_admin):
    h = _POR_NOMBRE.get(nombre)
    if not h:
        return {'error': f'Herramienta desconocida: {nombre}'}
    if not _tiene_acceso(h['modulo'], permisos, es_admin):
        return {'error': f'No tenés permiso para consultar el módulo {h["modulo"]}.'}
    try:
        return h['funcion'](args or {})
    except Exception as exc:  # noqa: BLE001
        return {'error': f'Error al ejecutar la consulta: {exc}'}


# ── Agente IA ──────────────────────────────────────────────────────────────
def _system_prompt(permitidos, denegados):
    labels_ok = ', '.join(MODULOS_LABEL[m] for m in permitidos) or 'ninguno'
    labels_no = ', '.join(MODULOS_LABEL[m] for m in denegados) or 'ninguno'
    hoy = ahora_bolivia().date().isoformat()
    return (
        "Sos el asistente virtual de ServiControl, un sistema de gestión para una empresa "
        "de seguridad electrónica. Ayudás a los usuarios a consultar información del sistema "
        "y a razonar sobre ella (por ejemplo, estimar costos de materiales).\n\n"
        f"Fecha de hoy: {hoy}.\n\n"
        "REGLAS:\n"
        "1. Respondé SIEMPRE en español y en formato Markdown (negritas, listas, encabezados "
        "y también TABLAS cuando ayuden a mostrar varios registros con columnas, por ejemplo "
        "un listado de pagos). Usá tablas Markdown con el formato "
        "`| Col1 | Col2 |` y la fila separadora `| --- | --- |`. Sé claro y conciso.\n"
        "2. Solo podés CONSULTAR información (solo lectura). Nunca afirmes que creaste, "
        "modificaste o eliminaste algo.\n"
        "3. Para obtener datos usá exclusivamente las herramientas disponibles. Nunca "
        "inventes datos: si una herramienta no devuelve resultados, decilo.\n"
        "4. Si la pregunta es ambigua o muy amplia (falta el cliente, el rango de fechas, "
        "el código de proyecto/orden, etc.), REPREGUNTÁ para acotar antes de consultar.\n"
        "5. Cuando hagas estimaciones o cálculos (costos aproximados, proyecciones), aclará "
        "explícitamente que son APROXIMADOS y explicá brevemente en qué te basaste.\n"
        f"6. El usuario tiene permiso para consultar estos módulos: {labels_ok}.\n"
        f"7. El usuario NO tiene permiso para: {labels_no}. Si su pregunta requiere alguno de "
        "estos, respondé lo que sí puedas con los módulos permitidos y avisale claramente que "
        "no tiene permiso para acceder a la parte restante (nombrá el módulo). No intentes "
        "rodear la restricción.\n"
        "8. Los montos están en bolivianos (Bs).\n"
        "9. ALCANCE: solo respondés consultas relacionadas con ServiControl y sus datos "
        "(clientes, proyectos, órdenes, cotizaciones, finanzas, mantenimiento, catálogo). "
        "Si te piden algo ajeno al sistema —escribir código, resolver tareas generales, "
        "matemáticas no relacionadas, conocimiento general, opiniones, traducciones, etc.— "
        "NO lo hagas: respondé brevemente que solo podés ayudar con consultas sobre "
        "ServiControl y ofrecé un ejemplo de lo que sí podés hacer. No inventes ni uses "
        "conocimiento externo al sistema."
    )


def _texto_de(respuesta):
    return ''.join(
        b.text for b in respuesta.content if getattr(b, 'type', None) == 'text'
    ).strip()


def _responder(pregunta, historial, permisos, es_admin):
    api_key = current_app.config.get('ANTHROPIC_API_KEY')
    if not api_key:
        return {'error': 'El asistente no está configurado (falta ANTHROPIC_API_KEY).'}

    permitidos = _modulos_permitidos(permisos, es_admin)
    if not permitidos:
        return {'error': 'Tu rol no tiene permiso para consultar ningún módulo con el asistente.'}

    tools  = _herramientas_permitidas(permisos, es_admin)
    system = _system_prompt(permitidos, _modulos_denegados(permisos, es_admin))

    mensajes = []
    for m in (historial or [])[-10:]:
        if m.get('role') in ('user', 'assistant') and m.get('content'):
            mensajes.append({'role': m['role'], 'content': m['content']})
    mensajes.append({'role': 'user', 'content': pregunta})

    try:
        import anthropic
    except ImportError:
        return {'error': 'El paquete anthropic no está instalado en el servidor.'}

    client  = anthropic.Anthropic(api_key=api_key)
    modelo  = current_app.config.get('ANTHROPIC_MODEL', 'claude-haiku-4-5-20251001')
    modulos_consultados = set()

    try:
        for _ in range(MAX_ITERACIONES):
            respuesta = client.messages.create(
                model=modelo, max_tokens=MAX_TOKENS, system=system,
                tools=tools, messages=mensajes,
            )

            if respuesta.stop_reason == 'tool_use':
                mensajes.append({'role': 'assistant', 'content': respuesta.content})
                resultados = []
                for bloque in respuesta.content:
                    if getattr(bloque, 'type', None) != 'tool_use':
                        continue
                    h = _POR_NOMBRE.get(bloque.name)
                    if h:
                        modulos_consultados.add(h['modulo'])
                    salida = _ejecutar_herramienta(bloque.name, bloque.input, permisos, es_admin)
                    resultados.append({
                        'type': 'tool_result',
                        'tool_use_id': bloque.id,
                        'content': json.dumps(salida, ensure_ascii=False),
                    })
                mensajes.append({'role': 'user', 'content': resultados})
                continue

            texto = _texto_de(respuesta)
            return {
                'respuesta': texto or 'No pude generar una respuesta. Reformulá tu pregunta.',
                'modulos_consultados': sorted(modulos_consultados),
            }

        return {
            'respuesta': 'La consulta resultó demasiado compleja. Probá dividirla en partes más simples.',
            'modulos_consultados': sorted(modulos_consultados),
        }
    except Exception as exc:  # noqa: BLE001
        current_app.logger.warning(f'Error en el agente del asistente: {exc}')
        return {'error': 'No se pudo procesar la consulta. Intentá nuevamente.'}


# ── Helpers de ruta ────────────────────────────────────────────────────────
def _permisos_usuario(usuario):
    nombres = [
        nombre for (nombre,) in (
            db.session.query(Permiso.nombre)
            .join(RolPermiso, RolPermiso.id_permiso == Permiso.id)
            .filter(RolPermiso.id_rol == usuario.id_rol)
            .all()
        )
    ]
    es_admin = bool(usuario.rol and usuario.rol.nombre == ROL_ADMIN)
    return nombres, es_admin


# ── Rutas ──────────────────────────────────────────────────────────────────
@bp.get('/modulos')
@jwt_required()
def modulos():
    usuario = db.session.get(Usuario, int(get_jwt_identity()))
    if not usuario:
        return jsonify({'error': 'Usuario no encontrado'}), 401
    permisos, es_admin = _permisos_usuario(usuario)
    permitidos = _modulos_permitidos(permisos, es_admin)
    return jsonify({
        'modulos': [{'clave': m, 'nombre': MODULOS_LABEL[m]} for m in permitidos],
        'disponible': bool(permitidos),
    })


@bp.post('/consultar')
@jwt_required()
def consultar():
    usuario = db.session.get(Usuario, int(get_jwt_identity()))
    if not usuario:
        return jsonify({'error': 'Usuario no encontrado'}), 401

    data     = request.get_json(silent=True) or {}
    pregunta = (data.get('pregunta') or '').strip()
    historial = data.get('historial') or []
    if not pregunta:
        return jsonify({'error': 'La pregunta no puede estar vacía'}), 400
    if len(pregunta) > 1000:
        return jsonify({'error': 'La pregunta es demasiado larga (máx. 1000 caracteres)'}), 400

    permisos, es_admin = _permisos_usuario(usuario)
    resultado = _responder(pregunta, historial, permisos, es_admin)

    if 'error' in resultado:
        return jsonify(resultado), 200

    log('CONSULTA_ASISTENTE',
        f'Consulta: "{pregunta[:120]}" | módulos: {resultado.get("modulos_consultados")}',
        id_usuario=usuario.id, modulo='asistente')

    return jsonify(resultado)
