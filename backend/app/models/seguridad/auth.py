from ..extensions import db


class Rol(db.Model):
    __tablename__ = 'rol'
    id = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String(50), nullable=False, unique=True)
    descripcion = db.Column(db.Text)

    usuarios = db.relationship('Usuario', back_populates='rol')


class Permiso(db.Model):
    __tablename__ = 'permiso'
    id = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String(100), nullable=False, unique=True)
    descripcion = db.Column(db.Text)


class RolPermiso(db.Model):
    __tablename__ = 'rol_permiso'
    id_rol = db.Column(db.Integer, db.ForeignKey('rol.id', name='fk_rol_permiso_rol'), primary_key=True)
    id_permiso = db.Column(db.Integer, db.ForeignKey('permiso.id', name='fk_rol_permiso_permiso'), primary_key=True)


class Usuario(db.Model):
    __tablename__ = 'usuario'
    id = db.Column(db.Integer, primary_key=True)
    id_rol = db.Column(db.Integer, db.ForeignKey('rol.id', name='fk_usuario_rol'), nullable=False)
    id_empleado = db.Column(db.Integer, db.ForeignKey('empleado.id', name='fk_usuario_empleado'), nullable=False)
    username = db.Column(db.String(50), nullable=False, unique=True)
    password = db.Column(db.String(255), nullable=False)
    email = db.Column(db.String(100))
    estado = db.Column(db.Boolean, default=True)
    ultimo_acceso = db.Column(db.DateTime)
    fecha_creacion = db.Column(db.DateTime, server_default=db.func.now())
    fecha_actualizacion = db.Column(db.DateTime, server_default=db.func.now(), onupdate=db.func.now())
    # Columnas de seguridad (vía migración)
    intentos_fallidos = db.Column(db.SmallInteger, nullable=False, default=0)
    bloqueado_hasta = db.Column(db.DateTime, nullable=True)
    veces_bloqueado = db.Column(db.SmallInteger, nullable=False, default=0)
    ultima_salida = db.Column(db.DateTime, nullable=True)

    rol = db.relationship('Rol', back_populates='usuarios')
    empleado = db.relationship('Empleado', back_populates='usuario')
