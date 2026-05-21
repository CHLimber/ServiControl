from app.extensions import db
from app.models.notificaciones.notificacion import Notificacion
from tests.conftest import crear_usuario, login, auth_headers


def _crear_notificacion(id_usuario, leida=False, url=None):
    n = Notificacion(
        id_usuario=id_usuario,
        titulo='Alerta de prueba',
        mensaje='Hay un mantenimiento próximo',
        tipo='alerta_mantenimiento',
        leida=leida,
        url=url,
    )
    db.session.add(n)
    db.session.commit()
    return n


class TestListarNotificaciones:
    def test_retorna_campos_correctos(self, client, app):
        with app.app_context():
            u = crear_usuario('notif_user', [])
            _crear_notificacion(u.id, url='/mantenimientos/5')
            _, data = login(client, 'notif_user')

        rv = client.get('/api/notificaciones/', headers=auth_headers(data['access_token']))

        assert rv.status_code == 200
        notifs = rv.get_json()
        assert len(notifs) == 1

        n = notifs[0]
        # Verifica que los nombres de campo son los correctos
        assert 'id' in n
        assert 'id_notificacion' not in n
        assert 'fecha_creacion' in n
        assert 'fecha' not in n
        assert 'url' in n
        assert 'url_referencia' not in n

    def test_retorna_solo_notificaciones_del_usuario(self, client, app):
        with app.app_context():
            u1 = crear_usuario('notif_u1', [])
            u2 = crear_usuario('notif_u2', [])
            _crear_notificacion(u1.id)
            _crear_notificacion(u1.id)
            _crear_notificacion(u2.id)
            _, data = login(client, 'notif_u1')

        rv = client.get('/api/notificaciones/', headers=auth_headers(data['access_token']))
        notifs = rv.get_json()

        assert len(notifs) == 2

    def test_url_nula_se_serializa_como_none(self, client, app):
        with app.app_context():
            u = crear_usuario('notif_url', [])
            _crear_notificacion(u.id, url=None)
            _, data = login(client, 'notif_url')

        rv = client.get('/api/notificaciones/', headers=auth_headers(data['access_token']))
        n = rv.get_json()[0]

        assert n['url'] is None

    def test_sin_token_es_401(self, client):
        rv = client.get('/api/notificaciones/')
        assert rv.status_code == 401


class TestMarcarLeida:
    def test_marca_notificacion_como_leida(self, client, app):
        with app.app_context():
            u = crear_usuario('leer_user', [])
            notif = _crear_notificacion(u.id, leida=False)
            notif_id = notif.id
            _, data = login(client, 'leer_user')

        rv = client.put(f'/api/notificaciones/{notif_id}/leer',
                        headers=auth_headers(data['access_token']))

        assert rv.status_code == 200

        with app.app_context():
            n = db.session.get(Notificacion, notif_id)
            assert n.leida is True

    def test_notificacion_inexistente_es_404(self, client, app):
        with app.app_context():
            crear_usuario('leer_user2', [])
            _, data = login(client, 'leer_user2')

        rv = client.put('/api/notificaciones/99999/leer',
                        headers=auth_headers(data['access_token']))

        assert rv.status_code == 404
