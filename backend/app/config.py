import os
from datetime import timedelta
from pathlib import Path
from dotenv import load_dotenv

# Ruta absoluta al .env — funciona sin importar desde dónde se ejecute
load_dotenv(Path(__file__).resolve().parent.parent / '.env', override=True)

# Directorio raíz del backend (carpeta "backend/")
_BASE_DIR = Path(__file__).resolve().parent.parent


class Config:
    SECRET_KEY = os.getenv('SECRET_KEY', 'dev-secret')
    JWT_SECRET_KEY = os.getenv('JWT_SECRET_KEY', 'dev-jwt-secret')

    # Uploads de documentos
    UPLOAD_FOLDER = str(_BASE_DIR / 'uploads' / 'documentos')
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024  # 16 MB
    ALLOWED_EXTENSIONS = {
        'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
        'txt', 'png', 'jpg', 'jpeg', 'gif', 'zip', 'rar',
    }
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(minutes=15)
    JWT_REFRESH_TOKEN_EXPIRES = timedelta(days=7)
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    _mysql_url = os.getenv('MYSQL_URL')
    if _mysql_url:
        SQLALCHEMY_DATABASE_URI = _mysql_url.replace('mysql://', 'mysql+pymysql://', 1) + '?charset=utf8mb4'
    else:
        SQLALCHEMY_DATABASE_URI = (
            f"mysql+pymysql://{os.getenv('DB_USER', 'root')}:{os.getenv('DB_PASSWORD', '')}"
            f"@{os.getenv('DB_HOST', 'localhost')}:{os.getenv('DB_PORT', '3306')}"
            f"/{os.getenv('DB_NAME', 'AWGPMCESE')}?charset=utf8mb4"
        )

    LOGIN_MAX_INTENTOS = int(os.getenv('LOGIN_MAX_INTENTOS', 3))
    # Tiempos de bloqueo progresivo (en minutos): 1er bloqueo, 2do, 3ro, 4to+
    LOGIN_TIEMPOS_BLOQUEO = [1, 3, 5, 15]

    MAIL_SERVER = os.getenv('MAIL_SERVER', 'smtp.gmail.com')
    MAIL_PORT = int(os.getenv('MAIL_PORT', 587))
    MAIL_USE_TLS = True
    MAIL_USE_SSL = False
    MAIL_USERNAME = os.getenv('MAIL_USERNAME')
    MAIL_PASSWORD = os.getenv('MAIL_PASSWORD')
    MAIL_DEFAULT_SENDER = os.getenv('MAIL_USERNAME')

    STRIPE_SECRET_KEY = os.getenv('STRIPE_SECRET_KEY', '')
    STRIPE_PUBLISHABLE_KEY = os.getenv('STRIPE_PUBLISHABLE_KEY', '')
    STRIPE_WEBHOOK_SECRET = os.getenv('STRIPE_WEBHOOK_SECRET', '')


class DevelopmentConfig(Config):
    DEBUG = True


class ProductionConfig(Config):
    DEBUG = False


class TestingConfig(Config):
    TESTING = True
    SQLALCHEMY_DATABASE_URI = 'sqlite://'
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(seconds=5)
    JWT_REFRESH_TOKEN_EXPIRES = timedelta(seconds=10)
    MAIL_SUPPRESS_SEND = True
    MAIL_SERVER = 'localhost'
    MAIL_USERNAME = 'test@test.com'
    MAIL_PASSWORD = 'test'


config = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'testing': TestingConfig,
    'default': DevelopmentConfig,
}
