from ..extensions import db


class EstadoOrden(db.Model):
    __tablename__ = 'estado_orden'
    id = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String(50), nullable=False, unique=True)
    orden = db.Column(db.Integer, nullable=False, unique=True)


class OrdenTrabajo(db.Model):
    __tablename__ = 'orden_trabajo'
    id = db.Column(db.Integer, primary_key=True)
    codigo = db.Column(db.String(20), nullable=False, unique=True)
    id_proyecto = db.Column(db.Integer, db.ForeignKey('proyecto.id', name='fk_orden_proyecto'), nullable=False)
    id_servicio = db.Column(db.Integer, db.ForeignKey('servicio.id', name='fk_orden_servicio'), nullable=False)
    id_estado_orden = db.Column(db.Integer, db.ForeignKey('estado_orden.id', name='fk_orden_estado'), nullable=False)
    id_usuario = db.Column(db.Integer, db.ForeignKey('usuario.id', name='fk_orden_usuario'), nullable=False)
    descripcion = db.Column(db.Text)
    fecha_ejecucion = db.Column(db.Date)
    tiempo_estimado = db.Column(db.Integer)
    observaciones = db.Column(db.Text)
    fecha_creacion = db.Column(db.DateTime, server_default=db.func.now())
    fecha_actualizacion = db.Column(db.DateTime, server_default=db.func.now(), onupdate=db.func.now())

    estado = db.relationship('EstadoOrden')
    empleados = db.relationship('OrdenEmpleado', back_populates='orden')
    productos = db.relationship('OrdenProducto', back_populates='orden')
    historial = db.relationship('OrdenHistorial', back_populates='orden')


class OrdenEmpleado(db.Model):
    __tablename__ = 'orden_empleado'
    id_orden_trabajo = db.Column(db.Integer, db.ForeignKey('orden_trabajo.id', name='fk_orden_emp_orden'), primary_key=True)
    id_empleado = db.Column(db.Integer, db.ForeignKey('empleado.id', name='fk_orden_emp_empleado'), primary_key=True)
    es_responsable = db.Column(db.Boolean, default=False)

    orden = db.relationship('OrdenTrabajo', back_populates='empleados')


class OrdenProducto(db.Model):
    __tablename__ = 'orden_producto'
    id_orden_trabajo = db.Column(db.Integer, db.ForeignKey('orden_trabajo.id', name='fk_ord_prod_orden'), primary_key=True)
    id_producto = db.Column(db.Integer, db.ForeignKey('producto.id', name='fk_ord_prod_producto'), primary_key=True)
    cantidad_asignada = db.Column(db.Numeric(10, 2), nullable=False)
    cantidad_usada = db.Column(db.Numeric(10, 2))
    observacion = db.Column(db.Text)

    orden = db.relationship('OrdenTrabajo', back_populates='productos')


class OrdenHistorial(db.Model):
    __tablename__ = 'orden_historial'
    id = db.Column(db.Integer, primary_key=True)
    id_orden_trabajo = db.Column(db.Integer, db.ForeignKey('orden_trabajo.id', name='fk_ord_hist_orden'), nullable=False)
    id_estado_anterior = db.Column(db.Integer, db.ForeignKey('estado_orden.id', name='fk_ord_hist_estado_ant'))
    id_estado_nuevo = db.Column(db.Integer, db.ForeignKey('estado_orden.id', name='fk_ord_hist_estado_nuevo'), nullable=False)
    id_usuario = db.Column(db.Integer, db.ForeignKey('usuario.id', name='fk_ord_hist_usuario'), nullable=False)
    fecha_cambio = db.Column(db.DateTime, server_default=db.func.now())
    observacion = db.Column(db.Text)

    orden = db.relationship('OrdenTrabajo', back_populates='historial')
