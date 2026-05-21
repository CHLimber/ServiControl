from ..extensions import db


class Pago(db.Model):
    __tablename__ = 'pago'
    id = db.Column(db.Integer, primary_key=True)
    id_proyecto = db.Column(db.Integer, db.ForeignKey('proyecto.id', name='fk_pago_proyecto'), nullable=False)
    id_usuario = db.Column(db.Integer, db.ForeignKey('usuario.id', name='fk_pago_usuario'), nullable=False)
    tipo_pago = db.Column(db.Enum('anticipo', 'pago_parcial', 'pago_final', 'otro'), nullable=False)
    monto = db.Column(db.Numeric(12, 2), nullable=False)
    fecha_pago = db.Column(db.Date, nullable=False)
    metodo = db.Column(db.Enum('efectivo', 'transferencia', 'QR', 'otro'), nullable=False)
    observacion = db.Column(db.Text)
    fecha_registro = db.Column(db.DateTime, server_default=db.func.now())


class GastoOrden(db.Model):
    __tablename__ = 'gasto_orden'
    id = db.Column(db.Integer, primary_key=True)
    id_orden = db.Column(db.Integer, db.ForeignKey('orden_trabajo.id', name='fk_gasto_orden'), nullable=False)
    id_usuario = db.Column(db.Integer, db.ForeignKey('usuario.id', name='fk_gasto_usuario'), nullable=False)
    concepto = db.Column(db.Enum('materiales', 'viaticos', 'transporte', 'otro'), nullable=False)
    descripcion = db.Column(db.Text)
    monto = db.Column(db.Numeric(12, 2), nullable=False)
    fecha_gasto = db.Column(db.Date, nullable=False)
    fecha_registro = db.Column(db.DateTime, server_default=db.func.now())
