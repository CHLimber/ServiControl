import threading
from flask import current_app
from flask_mail import Message
from ..extensions import mail


def _enviar_async(app, msg):
    with app.app_context():
        try:
            mail.send(msg)
        except Exception as e:
            print(f"[CORREO] Error al enviar email a {msg.recipients}: {e}")


def _enviar(destinatario: str, asunto: str, cuerpo: str, id_usuario: int = None):
    if not destinatario or not current_app.config.get('MAIL_USERNAME'):
        return
    app = current_app._get_current_object()
    msg = Message(subject=f"ServiControl — {asunto}", recipients=[destinatario], body=cuerpo)
    threading.Thread(target=_enviar_async, args=(app, msg), daemon=True).start()


def notificar_intento_fallido(email: str, username: str, intentos: int, restantes: int, id_usuario: int = None):
    _enviar(
        email,
        "Intento de acceso fallido",
        f"Hola {username},\n\n"
        f"Se registró un intento fallido de acceso a tu cuenta (intento {intentos}).\n"
        f"Te quedan {restantes} intento(s) antes de que la cuenta sea bloqueada temporalmente.\n\n"
        f"Si no fuiste tú, considera cambiar tu contraseña.\n\n"
        f"ServiControl",
        id_usuario=id_usuario,
    )


def notificar_cuenta_bloqueada(email: str, username: str, minutos: int, id_usuario: int = None):
    _enviar(
        email,
        "Cuenta bloqueada temporalmente",
        f"Hola {username},\n\n"
        f"Tu cuenta ha sido bloqueada temporalmente durante {minutos} minuto(s) "
        f"debido a múltiples intentos de acceso fallidos.\n\n"
        f"Si no fuiste tú quien intentó acceder, contacta al administrador del sistema.\n\n"
        f"ServiControl",
        id_usuario=id_usuario,
    )


def notificar_cambio_password(email: str, username: str, id_usuario: int = None):
    _enviar(
        email,
        "Contraseña actualizada",
        f"Hola {username},\n\n"
        f"La contraseña de tu cuenta ha sido cambiada exitosamente.\n\n"
        f"Si no realizaste este cambio, contacta al administrador del sistema de inmediato.\n\n"
        f"ServiControl",
        id_usuario=id_usuario,
    )


def notificar_cuenta_desbloqueada(email: str, username: str, id_usuario: int = None):
    _enviar(
        email,
        "Cuenta desbloqueada",
        f"Hola {username},\n\n"
        f"Un administrador ha desbloqueado tu cuenta. Ya puedes iniciar sesión.\n\n"
        f"ServiControl",
        id_usuario=id_usuario,
    )
