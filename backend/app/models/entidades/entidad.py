from ..extensions import db


class Entidad(db.Model):
    __tablename__ = 'entidad'
    id = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String(150), nullable=False)
    tipo = db.Column(db.Enum('natural', 'juridica'), nullable=False)
    email = db.Column(db.String(100))
    cliente = db.Column(db.Boolean, default=False)
    empleado = db.Column(db.Boolean, default=False)
    fecha_registro = db.Column(db.DateTime, server_default=db.func.now())
    estado = db.Column(db.Boolean, default=True)

    natural = db.relationship('EntidadNatural', back_populates='entidad', uselist=False)
    juridica = db.relationship('EntidadJuridica', back_populates='entidad', uselist=False)
    empleado_rel = db.relationship('Empleado', back_populates='entidad', uselist=False)


class EntidadNatural(db.Model):
    __tablename__ = 'entidad_natural'
    id_entidad = db.Column(db.Integer, db.ForeignKey('entidad.id', name='fk_entidad_natural_entidad'), primary_key=True)
    ci = db.Column(db.String(20), nullable=False)
    sexo = db.Column(db.String(1))
    fecha_nacimiento = db.Column(db.Date)

    entidad = db.relationship('Entidad', back_populates='natural')


class EntidadJuridica(db.Model):
    __tablename__ = 'entidad_juridica'
    id_entidad = db.Column(db.Integer, db.ForeignKey('entidad.id', name='fk_entidad_juridica_entidad'), primary_key=True)
    nit = db.Column(db.String(20))
    nombre_comercial = db.Column(db.String(150))
    razon_social = db.Column(db.String(200), nullable=False)

    entidad = db.relationship('Entidad', back_populates='juridica')


class Empleado(db.Model):
    __tablename__ = 'empleado'
    id = db.Column(db.Integer, primary_key=True)
    id_entidad = db.Column(db.Integer, db.ForeignKey('entidad.id', name='fk_empleado_entidad'), nullable=False)
    id_cargo = db.Column(db.Integer, db.ForeignKey('cargo.id', name='fk_empleado_cargo'))
    estado = db.Column(db.Boolean, default=True)
    fecha_creacion = db.Column(db.DateTime, server_default=db.func.now())

    entidad = db.relationship('Entidad', back_populates='empleado_rel')
    usuario = db.relationship('Usuario', back_populates='empleado', uselist=False)


class Establecimiento(db.Model):
    __tablename__ = 'establecimiento'
    id = db.Column(db.Integer, primary_key=True)
    id_entidad = db.Column(db.Integer, db.ForeignKey('entidad.id', name='fk_establecimiento_entidad'))
    id_municipio = db.Column(db.Integer, db.ForeignKey('municipio.id', name='fk_establecimiento_municipio'))
    id_tipo_establecimiento = db.Column(db.Integer, db.ForeignKey('tipo_establecimiento.id', name='fk_establecimiento_tipo'))
    direccion = db.Column(db.String(255))
    estado = db.Column(db.Boolean, default=True)
    fecha_creacion = db.Column(db.DateTime, server_default=db.func.now())


class Sistema(db.Model):
    __tablename__ = 'sistema'
    id = db.Column(db.Integer, primary_key=True)
    id_establecimiento = db.Column(db.Integer, db.ForeignKey('establecimiento.id', name='fk_sistema_establecimiento'), nullable=False)
    id_tipo_sistema = db.Column(db.Integer, db.ForeignKey('tipo_sistema.id', name='fk_sistema_tipo'), nullable=False)
    nombre = db.Column(db.String(150))
    tiene_mantenimiento = db.Column(db.Boolean, default=False)
    periodicidad_dias = db.Column(db.Integer)
    estado = db.Column(db.Boolean, default=True)
    fecha_creacion = db.Column(db.DateTime, server_default=db.func.now())
