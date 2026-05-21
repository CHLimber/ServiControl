import os
from flask import Flask
from .config import config
from .extensions import db, migrate, jwt, cors, mail


def create_app(env: str = None):
    app = Flask(__name__)
    env = env or os.getenv('FLASK_ENV', 'default')
    app.config.from_object(config[env])

    # Extensiones
    db.init_app(app)
    migrate.init_app(app, db)
    jwt.init_app(app)
    _raw = os.getenv('ALLOWED_ORIGINS', '*')
    origins = [o.strip() for o in _raw.split(',')] if _raw != '*' else '*'
    cors.init_app(app, resources={r'/api/*': {'origins': origins}})
    mail.init_app(app)

    # Blueprints
    from .routes.seguridad.auth       import bp as auth_bp
    from .routes.seguridad.usuarios   import bp as usuarios_bp
    from .routes.seguridad.roles      import bp as roles_bp
    from .routes.entidades.entidades  import bp as entidades_bp
    from .routes.catalogo.catalogos   import bp as catalogos_bp
    from .routes.catalogo.productos   import bp as productos_bp
    from .routes.cotizaciones.cotizaciones import bp as cotizaciones_bp
    from .routes.proyectos.proyectos  import bp as proyectos_bp
    from .routes.ordenes.ordenes      import bp as ordenes_bp
    from .routes.mantenimiento.mantenimiento import bp as mantenimiento_bp
    from .routes.finanzas.finanzas    import bp as finanzas_bp
    from .routes.notificaciones.notificaciones import bp as notificaciones_bp
    from .routes.auditoria.auditoria  import bp as auditoria_bp

    app.register_blueprint(auth_bp,          url_prefix='/api/auth')
    app.register_blueprint(usuarios_bp,      url_prefix='/api/usuarios')
    app.register_blueprint(roles_bp,         url_prefix='/api/roles')
    app.register_blueprint(entidades_bp,     url_prefix='/api/entidades')
    app.register_blueprint(catalogos_bp,     url_prefix='/api/catalogos')
    app.register_blueprint(productos_bp,     url_prefix='/api/productos')
    app.register_blueprint(cotizaciones_bp,  url_prefix='/api/cotizaciones')
    app.register_blueprint(proyectos_bp,     url_prefix='/api/proyectos')
    app.register_blueprint(ordenes_bp,       url_prefix='/api/ordenes')
    app.register_blueprint(mantenimiento_bp, url_prefix='/api/mantenimiento')
    app.register_blueprint(finanzas_bp,      url_prefix='/api/finanzas')
    app.register_blueprint(notificaciones_bp,url_prefix='/api/notificaciones')
    app.register_blueprint(auditoria_bp,     url_prefix='/api/auditoria')

    return app
