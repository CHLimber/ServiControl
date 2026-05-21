from ..extensions import db


class Producto(db.Model):
    __tablename__ = 'producto'
    id = db.Column(db.Integer, primary_key=True)
    id_categoria = db.Column(db.Integer, db.ForeignKey('categoria.id', name='fk_producto_categoria'), nullable=False)
    codigo = db.Column(db.String(20), nullable=False, unique=True)
    nombre = db.Column(db.String(150), nullable=False)
    unidad_medida = db.Column(db.String(30), nullable=False)
    descripcion = db.Column(db.Text)
    estado = db.Column(db.Boolean, default=True)
