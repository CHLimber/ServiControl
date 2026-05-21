from ..extensions import db


class EstadoProyecto(db.Model):
    __tablename__ = 'estado_proyecto'
    id = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String(50), nullable=False, unique=True)
    orden = db.Column(db.Integer, nullable=False, unique=True)


class Proyecto(db.Model):
    __tablename__ = 'proyecto'
    id = db.Column(db.Integer, primary_key=True)
    codigo = db.Column(db.String(20), nullable=False, unique=True)
    id_entidad = db.Column(db.Integer, db.ForeignKey('entidad.id', name='fk_proyecto_entidad'), nullable=False)
    id_establecimiento = db.Column(db.Integer, db.ForeignKey('establecimiento.id', name='fk_proyecto_establecimiento'), nullable=False)
    id_servicio = db.Column(db.Integer, db.ForeignKey('servicio.id', name='fk_proyecto_servicio'), nullable=False)
    id_estado_proyecto = db.Column(db.Integer, db.ForeignKey('estado_proyecto.id', name='fk_proyecto_estado'), nullable=False)
    id_usuario = db.Column(db.Integer, db.ForeignKey('usuario.id', name='fk_proyecto_usuario'), nullable=False)
    id_cotizacion = db.Column(db.Integer, db.ForeignKey('cotizacion.id', name='fk_proyecto_cotizacion'))
    id_sistema = db.Column(db.Integer, db.ForeignKey('sistema.id', name='fk_proyecto_sistema'), nullable=False)
    titulo = db.Column(db.String(200), nullable=False)
    descripcion = db.Column(db.Text)
    fecha_inicio = db.Column(db.Date)
    fecha_fin = db.Column(db.Date)
    fecha_creacion = db.Column(db.DateTime, server_default=db.func.now())
    fecha_actualizacion = db.Column(db.DateTime, server_default=db.func.now(), onupdate=db.func.now())

    estado = db.relationship('EstadoProyecto')
    historial = db.relationship('ProyectoHistorial', back_populates='proyecto')


class ProyectoHistorial(db.Model):
    __tablename__ = 'proyecto_historial'
    id = db.Column(db.Integer, primary_key=True)
    id_proyecto = db.Column(db.Integer, db.ForeignKey('proyecto.id', name='fk_proy_hist_proyecto'), nullable=False)
    id_estado_anterior = db.Column(db.Integer, db.ForeignKey('estado_proyecto.id', name='fk_proy_hist_estado_ant'))
    id_estado_nuevo = db.Column(db.Integer, db.ForeignKey('estado_proyecto.id', name='fk_proy_hist_estado_nuevo'), nullable=False)
    id_usuario = db.Column(db.Integer, db.ForeignKey('usuario.id', name='fk_proy_hist_usuario'), nullable=False)
    fecha_cambio = db.Column(db.DateTime, server_default=db.func.now())
    observacion = db.Column(db.Text)

    proyecto = db.relationship('Proyecto', back_populates='historial')
