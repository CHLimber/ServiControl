-- ============================================================
-- Migración: tablas de CU recientes que pueden faltar en BDs
-- pobladas antes de su implementación (notas de proyecto,
-- documentos y preferencias de notificación).
--
-- Seguro de re-ejecutar: usa CREATE TABLE IF NOT EXISTS.
--
-- Uso (desde la carpeta backend):
--   mysql -h <host> -P <port> -u <user> -p <nombre_bd> < migracion_tablas_faltantes.sql
-- ============================================================

CREATE TABLE IF NOT EXISTS bitacora_proyecto (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  id_proyecto    INT NOT NULL,
  id_usuario     INT NOT NULL,
  nota           TEXT NOT NULL,
  fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_bit_proy_proyecto FOREIGN KEY (id_proyecto) REFERENCES proyecto(id) ON DELETE CASCADE,
  CONSTRAINT fk_bit_proy_usuario  FOREIGN KEY (id_usuario)  REFERENCES usuario(id)  ON DELETE RESTRICT,

  INDEX idx_bitacora_proyecto_proyecto (id_proyecto),
  INDEX idx_bitacora_proyecto_fecha (fecha_creacion)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS documento (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  id_proyecto       INT,
  id_entidad        INT,
  id_usuario        INT NOT NULL,
  id_tipo_documento INT NOT NULL,
  nombre            VARCHAR(255) NOT NULL,
  ruta              VARCHAR(500) NOT NULL,
  fecha_subida      DATETIME DEFAULT CURRENT_TIMESTAMP,
  descripcion       TEXT,

  CONSTRAINT fk_doc_proyecto FOREIGN KEY (id_proyecto)       REFERENCES proyecto(id)      ON DELETE CASCADE,
  CONSTRAINT fk_doc_entidad  FOREIGN KEY (id_entidad)        REFERENCES entidad(id)       ON DELETE CASCADE,
  CONSTRAINT fk_doc_usuario  FOREIGN KEY (id_usuario)        REFERENCES usuario(id)       ON DELETE RESTRICT,
  CONSTRAINT fk_doc_tipo     FOREIGN KEY (id_tipo_documento) REFERENCES tipo_documento(id) ON DELETE RESTRICT,
  INDEX idx_documento_proyecto (id_proyecto),
  INDEX idx_documento_fecha (fecha_subida)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS preferencia_notificacion (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  id_usuario INT NOT NULL,
  tipo       ENUM('alerta_mantenimiento','orden_asignada','proyecto_actualizado','pago_registrado','stock_critico') NOT NULL,
  en_centro  BOOLEAN NOT NULL DEFAULT TRUE,
  en_correo  BOOLEAN NOT NULL DEFAULT TRUE,

  CONSTRAINT fk_pref_notif_usuario FOREIGN KEY (id_usuario) REFERENCES usuario(id) ON DELETE CASCADE,
  CONSTRAINT uq_pref_usuario_tipo UNIQUE (id_usuario, tipo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
