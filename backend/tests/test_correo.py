"""
Prueba de las alertas de correo del sistema.
Uso: python tests/test_correo.py [email_destino]
     Si no se pasa email, envía a nlimberchambi@gmail.com.
"""
import sys
import os
import time

# Asegurar que el working directory sea backend/ para que los imports funcionen
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import create_app
from app.utils import correo

EMAIL_PRUEBA = sys.argv[1] if len(sys.argv) > 1 else 'nlimberchambi@gmail.com'
USERNAME = 'claudia.ortiz'

app = create_app()

with app.app_context():
    print(f"\n=== Prueba de alertas de correo para: {EMAIL_PRUEBA} ===\n")

    print("1. Enviando alerta: intento fallido (intento 1 de 3)...")
    correo.notificar_intento_fallido(EMAIL_PRUEBA, USERNAME, intentos=1, restantes=2)
    print("   OK\n")

    print("2. Enviando alerta: intento fallido (intento 2 de 3)...")
    correo.notificar_intento_fallido(EMAIL_PRUEBA, USERNAME, intentos=2, restantes=1)
    print("   OK\n")

    print("3. Enviando alerta: cuenta bloqueada (15 minutos)...")
    correo.notificar_cuenta_bloqueada(EMAIL_PRUEBA, USERNAME, minutos=15)
    print("   OK\n")

    print("4. Enviando alerta: cuenta desbloqueada...")
    correo.notificar_cuenta_desbloqueada(EMAIL_PRUEBA, USERNAME)
    print("   OK\n")

    print("5. Enviando alerta: contraseña actualizada...")
    correo.notificar_cambio_password(EMAIL_PRUEBA, USERNAME)
    print("   OK\n")

    print("Esperando 5s para que los hilos de envío terminen...")
    time.sleep(5)
    print(f"\n=== Fin de prueba. Revisa la bandeja de entrada de: {EMAIL_PRUEBA} ===")
