import time
from tests.conftest import crear_usuario, login, auth_headers


class TestLogin:
    def test_login_exitoso(self, client, app):
        with app.app_context():
            crear_usuario('juan', [])

        status, data = login(client, 'juan')

        assert status == 200
        assert 'access_token' in data
        assert 'refresh_token' in data
        assert data['usuario']['username'] == 'juan'

    def test_login_password_incorrecta(self, client, app):
        with app.app_context():
            crear_usuario('maria', [])

        status, data = login(client, 'maria', password='mala')

        assert status == 401
        assert 'error' in data

    def test_login_usuario_inexistente(self, client):
        status, data = login(client, 'noexiste')

        assert status == 401
        assert 'error' in data

    def test_login_usuario_inactivo(self, client, app):
        from app.extensions import db
        from app.models.seguridad.auth import Usuario

        with app.app_context():
            u = crear_usuario('inactivo', [])
            u.estado = False
            db.session.commit()

        status, data = login(client, 'inactivo')

        assert status == 401

    def test_login_bloqueo_progresivo(self, client, app):
        with app.app_context():
            crear_usuario('bloqueado', [])

        # 3 intentos fallidos → bloqueo
        for _ in range(3):
            login(client, 'bloqueado', password='mala')

        status, data = login(client, 'bloqueado', password='mala')

        assert status == 423
        assert 'bloqueado_hasta' in data


class TestRefreshToken:
    def test_refresh_genera_nuevo_access_token(self, client, app):
        with app.app_context():
            crear_usuario('refresh_user', [])

        _, data = login(client, 'refresh_user')
        refresh_token = data['refresh_token']
        access_original = data['access_token']

        rv = client.post('/api/auth/refresh',
                         headers=auth_headers(refresh_token))

        assert rv.status_code == 200
        nuevo_token = rv.get_json()['access_token']
        assert nuevo_token != access_original

    def test_refresh_con_access_token_falla(self, client, app):
        with app.app_context():
            crear_usuario('refresh_user2', [])

        _, data = login(client, 'refresh_user2')
        access_token = data['access_token']

        # El endpoint /refresh requiere un refresh token, no un access token
        rv = client.post('/api/auth/refresh',
                         headers=auth_headers(access_token))

        assert rv.status_code == 422

    def test_refresh_sin_token_falla(self, client):
        rv = client.post('/api/auth/refresh')
        assert rv.status_code == 401

    def test_nuevo_access_token_es_valido(self, client, app):
        with app.app_context():
            crear_usuario('refresh_user3', [])

        _, data = login(client, 'refresh_user3')
        rv = client.post('/api/auth/refresh',
                         headers=auth_headers(data['refresh_token']))
        nuevo_token = rv.get_json()['access_token']

        # El nuevo access token debe poder acceder a rutas protegidas
        rv2 = client.get('/api/auth/me', headers=auth_headers(nuevo_token))
        assert rv2.status_code == 200
        assert rv2.get_json()['username'] == 'refresh_user3'

    def test_refresh_token_expirado(self, client, app):
        with app.app_context():
            crear_usuario('refresh_exp', [])

        _, data = login(client, 'refresh_exp')
        refresh_token = data['refresh_token']

        # El TestingConfig pone JWT_REFRESH_TOKEN_EXPIRES = 10s
        time.sleep(11)

        rv = client.post('/api/auth/refresh',
                         headers=auth_headers(refresh_token))
        assert rv.status_code == 401


class TestLogoutYMe:
    def test_me_retorna_datos_del_usuario(self, client, app):
        with app.app_context():
            crear_usuario('yo', ['ver_proyectos'])

        _, data = login(client, 'yo')
        rv = client.get('/api/auth/me', headers=auth_headers(data['access_token']))

        assert rv.status_code == 200
        body = rv.get_json()
        assert body['username'] == 'yo'
        assert 'rol' in body

    def test_me_sin_token_es_401(self, client):
        rv = client.get('/api/auth/me')
        assert rv.status_code == 401

    def test_logout_exitoso(self, client, app):
        with app.app_context():
            crear_usuario('salida', [])

        _, data = login(client, 'salida')
        rv = client.post('/api/auth/logout',
                         headers=auth_headers(data['access_token']))

        assert rv.status_code == 200
