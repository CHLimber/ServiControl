from ..extensions import db


class Notificacion(db.Model):
    __tablename__ = 'notificacion'
    id = db.Column(db.Integer, primary_key=True)
    id_usuario = db.Column(db.Integer, db.ForeignKey('usuario.id', name='fk_notif_usuario'), nullable=False)
    titulo = db.Column(db.String(200), nullable=False)
    mensaje = db.Column(db.Text, nullable=False)
    tipo = db.Column(db.Enum(
        'alerta_mantenimiento', 'orden_asignada',
        'proyecto_actualizado', 'pago_registrado', 'stock_critico'
    ), nullable=False)
    leida = db.Column(db.Boolean, default=False)
    url = db.Column(db.String(300))
    fecha_creacion = db.Column(db.DateTime, server_default=db.func.now())
