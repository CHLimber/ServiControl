from ...extensions import db
from ...utils.timezone import ahora_bolivia

DEPARTAMENTOS = [
    'Santa Cruz', 'La Paz', 'Cochabamba', 'Potosí',
    'Chuquisaca', 'Tarija', 'Beni', 'Pando', 'Oruro',
]


class Proveedor(db.Model):
    __tablename__ = 'proveedor'
    id = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String(150), nullable=False)
    email = db.Column(db.String(100))
    direccion = db.Column(db.String(255))
    departamento = db.Column(db.Enum(*DEPARTAMENTOS))
    estado = db.Column(db.Boolean, default=True)
    fecha_registro = db.Column(db.DateTime, default=ahora_bolivia)
