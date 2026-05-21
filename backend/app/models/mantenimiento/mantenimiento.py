from ..extensions import db


class Mantenimiento(db.Model):
    __tablename__ = 'mantenimiento'
    id = db.Column(db.Integer, primary_key=True)
    id_sistema = db.Column(db.Integer, db.ForeignKey('sistema.id', name='fk_mant_sistema'), nullable=False)
    id_orden_trabajo = db.Column(db.Integer, db.ForeignKey('orden_trabajo.id', name='fk_mant_orden'))
    id_usuario = db.Column(db.Integer, db.ForeignKey('usuario.id', name='fk_mant_usuario'))
    tipo = db.Column(db.Enum('preventivo', 'correctivo'), nullable=False)
    fecha_programada = db.Column(db.Date, nullable=False)
    periodicidad_dias = db.Column(db.Integer)
    estado = db.Column(db.Enum('pendiente', 'confirmado', 'reprogramado', 'completado', 'vencido'))
    creado_automaticamente = db.Column(db.Boolean, default=False)
    fecha_creacion = db.Column(db.DateTime, server_default=db.func.now())

    alertas = db.relationship('AlertaMantenimiento', back_populates='mantenimiento')


class AlertaMantenimiento(db.Model):
    __tablename__ = 'alerta_mantenimiento'
    id = db.Column(db.Integer, primary_key=True)
    id_mantenimiento = db.Column(db.Integer, db.ForeignKey('mantenimiento.id', name='fk_alerta_mant_mant'), nullable=False)
    id_usuario = db.Column(db.Integer, db.ForeignKey('usuario.id', name='fk_alerta_mant_usuario'), nullable=False)
    id_establecimiento = db.Column(db.Integer, db.ForeignKey('establecimiento.id', name='fk_alerta_mant_estab'), nullable=False)
    fecha = db.Column(db.DateTime, server_default=db.func.now())
    estado = db.Column(db.Enum('pendiente', 'enviada', 'leida', 'completada'), default='pendiente')
    observacion = db.Column(db.Text)

    mantenimiento = db.relationship('Mantenimiento', back_populates='alertas')
