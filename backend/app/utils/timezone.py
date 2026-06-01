from datetime import datetime, timezone, timedelta

BOLIVIA_TZ = timezone(timedelta(hours=-4))


def ahora_bolivia() -> datetime:
    """Retorna la fecha y hora actual en zona horaria de Bolivia (UTC-4), sin info de zona."""
    return datetime.now(tz=BOLIVIA_TZ).replace(tzinfo=None)
