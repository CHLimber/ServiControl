from ..extensions import db


class BitacoraCliente(db.Model):
    __tablename__ = 'bitacora_cliente'
    id = db.Column(db.Integer, primary_key=True)
    id_entidad = db.Column(db.Integer, db.ForeignKey('entidad.id', name='fk_bit_cli_entidad'), nullable=False)
    id_usuario = db.Column(db.Integer, db.ForeignKey('usuario.id', name='fk_bit_cli_usuario'), nullable=False)
    nota = db.Column(db.Text, nullable=False)
    fecha_creacion = db.Column(db.DateTime, server_default=db.func.now())


class BitacoraProyecto(db.Model):
    __tablename__ = 'bitacora_proyecto'
    id = db.Column(db.Integer, primary_key=True)
    id_proyecto = db.Column(db.Integer, db.ForeignKey('proyecto.id', name='fk_bit_proy_proyecto'), nullable=False)
    id_usuario = db.Column(db.Integer, db.ForeignKey('usuario.id', name='fk_bit_proy_usuario'), nullable=False)
    nota = db.Column(db.Text, nullable=False)
    fecha_creacion = db.Column(db.DateTime, server_default=db.func.now())


class Documento(db.Model):
    __tablename__ = 'documento'
    id = db.Column(db.Integer, primary_key=True)
    id_proyecto = db.Column(db.Integer, db.ForeignKey('proyecto.id', name='fk_doc_proyecto'))
    id_entidad = db.Column(db.Integer, db.ForeignKey('entidad.id', name='fk_doc_entidad'))
    id_usuario = db.Column(db.Integer, db.ForeignKey('usuario.id', name='fk_doc_usuario'), nullable=False)
    id_tipo_documento = db.Column(db.Integer, db.ForeignKey('tipo_documento.id', name='fk_doc_tipo'), nullable=False)
    nombre = db.Column(db.String(255), nullable=False)
    ruta = db.Column(db.String(500), nullable=False)
    fecha_subida = db.Column(db.DateTime, server_default=db.func.now())
    descripcion = db.Column(db.Text)
