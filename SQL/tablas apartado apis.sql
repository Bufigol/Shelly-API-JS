CREATE TABLE `api_channel_feeds` (
  `idchannel_feeds` int NOT NULL AUTO_INCREMENT,
  `channel_id` int NOT NULL,
  `field1` double DEFAULT NULL,
  `field2` double DEFAULT NULL,
  `field3` double DEFAULT NULL,
  `field4` double DEFAULT NULL,
  `field5` double DEFAULT NULL,
  `field6` double DEFAULT NULL,
  `field7` double DEFAULT NULL,
  `field8` double DEFAULT NULL,
  `field9` double DEFAULT NULL,
  `field10` double DEFAULT NULL,
  `field11` double DEFAULT NULL,
  `field12` double DEFAULT NULL,
  `field13` double DEFAULT NULL,
  `field14` double DEFAULT NULL,
  `field15` double DEFAULT NULL,
  `field16` double DEFAULT NULL,
  `field17` double DEFAULT NULL,
  `field18` double DEFAULT NULL,
  `field19` double DEFAULT NULL,
  `field20` double DEFAULT NULL,
  `latitude` double DEFAULT NULL,
  `longitude` double DEFAULT NULL,
  `elevation` double DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `status` varchar(255) DEFAULT NULL,
  `usage` double DEFAULT NULL,
  `nt` varchar(255) DEFAULT NULL,
  `log` text,
  PRIMARY KEY (`idchannel_feeds`),
  KEY `fk_channel_feed-equipo-channel_id_idx` (`channel_id`),
  CONSTRAINT `fk_channel_feed-equipo-channel_id` FOREIGN KEY (`channel_id`) REFERENCES `api_equipo` (`chanel_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


CREATE TABLE `api_clientes` (
  `idClientes` int NOT NULL AUTO_INCREMENT,
  `id_cliente_externo` varchar(45) NOT NULL,
  `nombre_cliente` varchar(45) NOT NULL,
  PRIMARY KEY (`idClientes`),
  UNIQUE KEY `nombre_UNIQUE` (`id_cliente_externo`),
  UNIQUE KEY `idClientes_UNIQUE` (`idClientes`),
  UNIQUE KEY `nombre_cliente_UNIQUE` (`nombre_cliente`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


CREATE TABLE `api_datos_por_faena` (
  `idDatos_por_faena` int NOT NULL AUTO_INCREMENT,
  `id_faena` int NOT NULL,
  `timestamp_dato` timestamp NOT NULL,
  `temperatura` double DEFAULT NULL,
  `latitud` double DEFAULT NULL,
  `longitud` double DEFAULT NULL,
  PRIMARY KEY (`idDatos_por_faena`),
  KEY `fk_faena-datos_por_faena-id_faena_idx` (`id_faena`),
  CONSTRAINT `fk_faena-datos_por_faena-id_faena` FOREIGN KEY (`id_faena`) REFERENCES `api_faena` (`id_Faena`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


CREATE TABLE `api_equipo` (
  `id_Equipo` int NOT NULL AUTO_INCREMENT,
  `chanel_id` int NOT NULL,
  `fecha_creacion` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `fecha_actualizacion` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `device_id` varchar(255) DEFAULT NULL,
  `status` text,
  `mac_address` varchar(45) DEFAULT NULL,
  `product_id` varchar(100) DEFAULT NULL,
  `firmware` varchar(50) DEFAULT NULL,
  `timezone` varchar(255) DEFAULT NULL,
  `id_cliente` int DEFAULT NULL,
  `apikey` varchar(50) NOT NULL,
  PRIMARY KEY (`id_Equipo`),
  UNIQUE KEY `chanel_id_UNIQUE` (`chanel_id`),
  UNIQUE KEY `id_Equipo_UNIQUE` (`id_Equipo`),
  KEY `fk_cliente-equipo_id_cliente_idx` (`id_cliente`),
  CONSTRAINT `fk_cliente-equipo_id_cliente` FOREIGN KEY (`id_cliente`) REFERENCES `api_clientes` (`idClientes`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


CREATE TABLE `api_faena` (
  `id_Faena` int NOT NULL AUTO_INCREMENT,
  `id_Faena_externo` varchar(45) DEFAULT NULL,
  `fecha_inico` timestamp NOT NULL,
  `fecha_fin` timestamp NULL DEFAULT NULL,
  `id_maquina` int DEFAULT NULL,
  `id_cliente` int DEFAULT NULL,
  PRIMARY KEY (`id_Faena`),
  KEY `fk_maquina-faena_id_maquina_idx` (`id_maquina`),
  KEY `fk_cliente-faena_id_cliente_idx` (`id_cliente`),
  CONSTRAINT `fk_cliente-faena_id_cliente` FOREIGN KEY (`id_cliente`) REFERENCES `api_clientes` (`idClientes`),
  CONSTRAINT `fk_maquina-faena_id_maquina` FOREIGN KEY (`id_maquina`) REFERENCES `api_maquina` (`id_Maquina`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


CREATE TABLE `api_log_maquinas_equipos` (
  `id_log_maquinas_equipos` int NOT NULL AUTO_INCREMENT,
  `id_maquina` int NOT NULL,
  `id_equipo_antiguo` int NOT NULL,
  `id_equipo_nuevo` int NOT NULL,
  `fecha_actualizacion` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_log_maquinas_equipos`),
  UNIQUE KEY `id_log_maquinas_equipos_UNIQUE` (`id_log_maquinas_equipos`),
  KEY `fk_maquina-log_idmaquina_idx` (`id_maquina`),
  KEY `fk_equipo-log_id_equipo_antiguo_idx` (`id_equipo_antiguo`),
  KEY `fk_equipo-log_id_equipo_nuevo_idx` (`id_equipo_nuevo`),
  CONSTRAINT `fk_equipo-log_id_equipo_antiguo` FOREIGN KEY (`id_equipo_antiguo`) REFERENCES `api_equipo` (`id_Equipo`),
  CONSTRAINT `fk_equipo-log_id_equipo_nuevo` FOREIGN KEY (`id_equipo_nuevo`) REFERENCES `api_equipo` (`id_Equipo`),
  CONSTRAINT `fk_maquina-log_id_maquina` FOREIGN KEY (`id_maquina`) REFERENCES `api_maquina` (`id_Maquina`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


CREATE TABLE `api_maquina` (
  `id_Maquina` int NOT NULL AUTO_INCREMENT,
  `identificador_externo` varchar(45) NOT NULL,
  `id_equipo` int NOT NULL,
  `fecha_creacion` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `fecha_actualizacion` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_Maquina`),
  UNIQUE KEY `id_equipo_UNIQUE` (`id_equipo`),
  UNIQUE KEY `id_Maquina_UNIQUE` (`id_Maquina`),
  UNIQUE KEY `identificador_externo_UNIQUE` (`identificador_externo`),
  CONSTRAINT `fk_equipo-maquina_id_Equipo` FOREIGN KEY (`id_equipo`) REFERENCES `api_equipo` (`id_Equipo`) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


CREATE TABLE `api_permisos` (
  `id_Permisos` int NOT NULL AUTO_INCREMENT,
  `nombre_pemiso` varchar(45) NOT NULL,
  PRIMARY KEY (`id_Permisos`),
  UNIQUE KEY `id_Permisos_UNIQUE` (`id_Permisos`),
  UNIQUE KEY `nombre_pemiso_UNIQUE` (`nombre_pemiso`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


CREATE TABLE `api_resumen_Datos_por_faena` (
  `id_resumen_datos_faena` int NOT NULL AUTO_INCREMENT,
  `id_faena` int NOT NULL,
  `cuarto` enum('1','2','3','4') NOT NULL,
  `temperatura_maxima` double NOT NULL,
  `temperatura_minima` double NOT NULL,
  `promedio_temperatura` double NOT NULL,
  `latitud_inicio` double NOT NULL,
  `longitud_inicio` double NOT NULL,
  `latitud_final` double NOT NULL,
  `longitud_final` double NOT NULL,
  `numero_pasadas` int NOT NULL,
  `cumple_rango_temperatura` tinyint NOT NULL DEFAULT '1',
  PRIMARY KEY (`id_resumen_datos_faena`),
  UNIQUE KEY `uk_faena_cuarto` (`id_faena`,`cuarto`),
  CONSTRAINT `fk_faena-resumen_datos_por_faena-id_faena` FOREIGN KEY (`id_faena`) REFERENCES `api_faena` (`id_Faena`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


CREATE TABLE `api_sensor_thresholds` (
  `id_sensor_thresholds` int NOT NULL AUTO_INCREMENT,
  `channel_id` int NOT NULL,
  `field_name` varchar(45) NOT NULL,
  `low_threshold` double DEFAULT NULL,
  `high_threshold` double DEFAULT NULL,
  `critical_low` double DEFAULT NULL,
  `critical_high` double DEFAULT NULL,
  PRIMARY KEY (`id_sensor_thresholds`),
  KEY `fk_equipo-sensor_thresholds_chanel_id_idx` (`channel_id`),
  CONSTRAINT `fk_equipo-sensor_thresholds_chanel_id` FOREIGN KEY (`channel_id`) REFERENCES `api_equipo` (`chanel_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


CREATE TABLE `api_usuario` (
  `id_Usuario` int NOT NULL AUTO_INCREMENT,
  `email` varchar(50) NOT NULL,
  `password` varchar(150) NOT NULL,
  `fecha_creacion` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `fecha_actualizacion` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_Usuario`),
  UNIQUE KEY `id_Usuario_UNIQUE` (`id_Usuario`),
  UNIQUE KEY `email_UNIQUE` (`email`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


CREATE TABLE `api_usuarios_permisos` (
  `id_usuario` int NOT NULL,
  `id_permiso` int NOT NULL,
  `fecha_otorgacion` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `fecha_caducidad` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id_usuario`,`id_permiso`),
  KEY `fk_Permisos-usuarios_permisos-id_Permisos_idx` (`id_permiso`),
  CONSTRAINT `fk_Permisos-usuarios_permisos-id_Permisos` FOREIGN KEY (`id_permiso`) REFERENCES `api_permisos` (`id_Permisos`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_usuario-usuario_permisos_id-Usuario` FOREIGN KEY (`id_usuario`) REFERENCES `api_usuario` (`id_Usuario`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
