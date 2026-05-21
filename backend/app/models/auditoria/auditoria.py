from ..extensions import db


class Bitacora(db.Model):
    __tablename__ = 'bitacora'
    id = db.Column(db.Integer, primary_key=True)
    id_usuario = db.Column(db.Integer, db.ForeignKey('usuario.id', name='fk_bitacora_usuario'), nullable=True)
    accion = db.Column(db.String(50), nullable=False)
    modulo = db.Column(db.String(50), nullable=True)
    descripcion = db.Column(db.Text, nullable=True)
    ip = db.Column(db.String(45), nullable=True)
    fecha = db.Column(db.DateTime, server_default=db.func.now(), nullable=False)

    usuario = db.relationship('Usuario', foreign_keys=[id_usuario])
    detalles = db.relationship('BitacoraDetalle', backref='bitacora', cascade='all, delete-orphan')

    __table_args__ = (
        db.Index('ix_bitacora_id_usuario', 'id_usuario'),
        db.Index('ix_bitacora_accion', 'accion'),
        db.Index('ix_bitacora_modulo', 'modulo'),
        db.Index('ix_bitacora_fecha', 'fecha'),
    )


class BitacoraDetalle(db.Model):
    __tablename__ = 'bitacora_detalle'
    id = db.Column(db.Integer, primary_key=True)
    id_bitacora = db.Column(db.Integer, db.ForeignKey('bitacora.id', name='fk_bitdet_bitacora', ondelete='CASCADE'), nullable=False)
    campo = db.Column(db.String(100), nullable=False)
    valor_anterior = db.Column(db.Text, nullable=True)
    valor_nuevo = db.Column(db.Text, nullable=True)
