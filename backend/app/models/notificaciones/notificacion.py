from ...extensions import db
from ...utils.timezone import ahora_bolivia

# Tipos de notificación reconocidos por el sistema (reutilizados en preferencias)
TIPOS_NOTIFICACION = (
    'alerta_mantenimiento', 'orden_asignada',
    'proyecto_actualizado', 'pago_registrado', 'stock_critico',
)


class Notificacion(db.Model):
    __tablename__ = 'notificacion'
    id = db.Column(db.Integer, primary_key=True)
    id_usuario = db.Column(db.Integer, db.ForeignKey('usuario.id', name='fk_notif_usuario'), nullable=False)
    titulo = db.Column(db.String(200), nullable=False)
    mensaje = db.Column(db.Text, nullable=False)
    tipo = db.Column(db.Enum(*TIPOS_NOTIFICACION), nullable=False)
    leida = db.Column(db.Boolean, default=False)
    url = db.Column(db.String(300))
    fecha_creacion = db.Column(db.DateTime, default=ahora_bolivia)


class PreferenciaNotificacion(db.Model):
    """CU45 — Preferencias de notificación por usuario y tipo.

    Define, para cada tipo de evento, si el usuario desea recibirlo en el
    centro de notificaciones (en_centro) y/o por correo electrónico (en_correo).
    """
    __tablename__ = 'preferencia_notificacion'
    id = db.Column(db.Integer, primary_key=True)
    id_usuario = db.Column(db.Integer, db.ForeignKey('usuario.id', name='fk_pref_notif_usuario'), nullable=False)
    tipo = db.Column(db.Enum(*TIPOS_NOTIFICACION), nullable=False)
    en_centro = db.Column(db.Boolean, nullable=False, default=True)
    en_correo = db.Column(db.Boolean, nullable=False, default=True)

    __table_args__ = (
        db.UniqueConstraint('id_usuario', 'tipo', name='uq_pref_usuario_tipo'),
    )
