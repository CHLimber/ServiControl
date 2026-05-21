from ..extensions import db


class Cotizacion(db.Model):
    __tablename__ = 'cotizacion'
    id = db.Column(db.Integer, primary_key=True)
    codigo = db.Column(db.String(20), nullable=False, unique=True)
    id_entidad = db.Column(db.Integer, db.ForeignKey('entidad.id', name='fk_cotizacion_entidad'), nullable=False)
    id_servicio = db.Column(db.Integer, db.ForeignKey('servicio.id', name='fk_cotizacion_servicio'), nullable=False)
    id_usuario = db.Column(db.Integer, db.ForeignKey('usuario.id', name='fk_cotizacion_usuario'), nullable=False)
    id_sistema = db.Column(db.Integer, db.ForeignKey('sistema.id', name='fk_cotizacion_sistema'), nullable=False)
    estado = db.Column(db.Enum('borrador', 'enviada', 'aprobada', 'rechazada', 'vencida'), default='borrador')
    subtotal_productos = db.Column(db.Numeric(12, 2), default=0)
    mano_de_obra = db.Column(db.Numeric(12, 2), default=0)
    vigencia_dias = db.Column(db.Integer, default=30)
    observacion = db.Column(db.Text)
    fecha_creacion = db.Column(db.DateTime, server_default=db.func.now())
    fecha_actualizacion = db.Column(db.DateTime, server_default=db.func.now(), onupdate=db.func.now())

    detalles = db.relationship('CotizacionDetalle', back_populates='cotizacion')


class CotizacionDetalle(db.Model):
    __tablename__ = 'cotizacion_detalle'
    id = db.Column(db.Integer, primary_key=True)
    id_cotizacion = db.Column(db.Integer, db.ForeignKey('cotizacion.id', name='fk_cot_det_cotizacion'), nullable=False)
    id_producto = db.Column(db.Integer, db.ForeignKey('producto.id', name='fk_cot_det_producto'), nullable=False)
    id_proveedor = db.Column(db.Integer, db.ForeignKey('proveedor.id', name='fk_cot_det_proveedor'), nullable=False)
    cantidad = db.Column(db.Numeric(10, 2), nullable=False)
    precio_unitario = db.Column(db.Numeric(12, 2), nullable=False)
    subtotal = db.Column(db.Numeric(12, 2), nullable=False)
    observacion = db.Column(db.Text)

    cotizacion = db.relationship('Cotizacion', back_populates='detalles')
