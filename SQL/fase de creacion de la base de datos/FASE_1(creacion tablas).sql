create table sem_grupos
(
    id                  int auto_increment
        primary key,
    nombre              varchar(100)                         not null,
    descripcion         text                                 null,
    activo              tinyint(1) default 1                 null,
    fecha_creacion      timestamp  default CURRENT_TIMESTAMP null,
    fecha_actualizacion timestamp  default CURRENT_TIMESTAMP null on update CURRENT_TIMESTAMP,
    constraint idx_grupo_nombre
        unique (nombre)
)
    comment 'Grupos para categorización de dispositivos Shelly Pro 3 EM' collate = utf8mb4_unicode_ci;

create table sem_auditoria_detallada
(
    id               bigint auto_increment  primary key,
    tipo_operacion   enum ('INSERT', 'UPDATE', 'DELETE')       not null,
    tabla_afectada   varchar(100)                              not null,
    registro_id      varchar(100)                              not null,
    usuario          varchar(100)                              null,
    datos_anteriores json                                      null,
    datos_nuevos     json                                      null,
    fecha_operacion  timestamp(6) default CURRENT_TIMESTAMP(6) null,
    direccion_ip     varchar(45)                               null,
    aplicacion       varchar(100)                              null
);

create table sem_configuracion
(
    id                  int auto_increment
        primary key,
    tipo_parametro_id   int                                  not null,
    valor               text                                 not null,
    activo              tinyint(1) default 1                 null,
    valido_desde        timestamp  default CURRENT_TIMESTAMP not null,
    valido_hasta        timestamp                            null,
    fecha_creacion      timestamp  default CURRENT_TIMESTAMP null,
    fecha_actualizacion timestamp  default CURRENT_TIMESTAMP null on update CURRENT_TIMESTAMP
);

create table sem_dispositivos
(
    shelly_id           varchar(12)                            not null comment 'ID único del dispositivo Shelly'
        primary key,
    grupo_id            int                                    not null,
    nombre              varchar(100)                           not null,
    descripcion         text                                   null,
    ubicacion           text                                   not null,
    direccion_mac       varchar(17)                            not null,
    direccion_ip        varchar(45)                            null,
    zona_horaria        varchar(50) default 'America/Santiago' null,
    fecha_instalacion   timestamp                              not null,
    activo              tinyint(1)  default 1                  null,
    fecha_creacion      timestamp   default CURRENT_TIMESTAMP  null,
    fecha_actualizacion timestamp   default CURRENT_TIMESTAMP  null on update CURRENT_TIMESTAMP,
    constraint idx_dispositivo_mac
        unique (direccion_mac),
    constraint sem_dispositivos_ibfk_1
        foreign key (grupo_id) references sem_grupos (id)
)
    comment 'Registro de dispositivos Shelly Pro 3 EM' collate = utf8mb4_unicode_ci;

create table sem_control_calidad
(
    id                    bigint auto_increment
        primary key,
    shelly_id             varchar(12)                             not null,
    inicio_periodo        timestamp                               not null,
    fin_periodo           timestamp                               not null,
    lecturas_esperadas    int                                     not null,
    lecturas_recibidas    int                                     not null,
    lecturas_validas      int                                     not null,
    lecturas_alertas      int                                     not null,
    lecturas_error        int                                     not null,
    lecturas_interpoladas int                                     not null,
    porcentaje_calidad    decimal(5, 2)                           not null,
    estado_validacion     enum ('PENDIENTE', 'VALIDADO', 'ERROR') not null,
    detalles_validacion   json                                    null,
    fecha_validacion      timestamp                               null,
    fecha_creacion        timestamp default CURRENT_TIMESTAMP     null,
    constraint sem_control_calidad_ibfk_1
        foreign key (shelly_id) references sem_dispositivos (shelly_id)
)
    comment 'Control de calidad de mediciones' collate = utf8mb4_unicode_ci;


create table sem_estado_dispositivo
(
    id                  bigint auto_increment
        primary key,
    shelly_id           varchar(12)                                 not null,
    timestamp_local     timestamp(6)                                not null,
    estado_conexion     enum ('CONECTADO', 'DESCONECTADO', 'ERROR') not null,
    rssi_wifi           int                                         null,
    direccion_ip        varchar(45)                                 null,
    temperatura_celsius decimal(5, 2)                               null,
    uptime_segundos     bigint                                      null,
    fecha_creacion      timestamp(6) default CURRENT_TIMESTAMP(6)   null
)
    comment 'Estado general del dispositivo Shelly' collate = utf8mb4_unicode_ci;

create table sem_grupo_promedios
(
    id                         bigint auto_increment
        primary key,
    grupo_id                   int                                 not null,
    periodo_tipo               enum ('HORA', 'DIA', 'MES')         not null,
    periodo_inicio             timestamp                           not null,
    periodo_fin                timestamp                           not null,
    dispositivos_activos       int                                 not null,
    dispositivos_con_datos     int                                 not null,
    potencia_activa_promedio   decimal(10, 2)                      null,
    potencia_aparente_promedio decimal(10, 2)                      null,
    factor_potencia_promedio   decimal(5, 3)                       null,
    factor_utilizacion         decimal(5, 2)                       null,
    calidad_promedio           decimal(5, 2)                       null,
    fecha_creacion             timestamp default CURRENT_TIMESTAMP not null,
    fecha_actualizacion        timestamp default CURRENT_TIMESTAMP not null on update CURRENT_TIMESTAMP
)
    comment 'Promedios por grupo de dispositivos' collate = utf8mb4_unicode_ci;


create table sem_grupo_totales
(
    id                     bigint auto_increment
        primary key,
    grupo_id               int                                 not null,
    periodo_tipo           enum ('HORA', 'DIA', 'MES')         not null,
    periodo_inicio         timestamp                           not null,
    periodo_fin            timestamp                           not null,
    dispositivos_total     int                                 not null,
    dispositivos_activos   int                                 not null,
    dispositivos_con_datos int                                 not null,
    energia_activa_total   decimal(15, 3)                      not null,
    energia_reactiva_total decimal(15, 3)                      null,
    potencia_maxima        decimal(10, 2)                      null,
    potencia_minima        decimal(10, 2)                      null,
    precio_kwh_promedio    decimal(10, 2)                      not null,
    costo_total            decimal(15, 2)                      not null,
    fecha_creacion         timestamp default CURRENT_TIMESTAMP not null,
    fecha_actualizacion    timestamp default CURRENT_TIMESTAMP not null on update CURRENT_TIMESTAMP
)
    comment 'Totales por grupo de dispositivos' collate = utf8mb4_unicode_ci;





create table sem_historial_grupo_dispositivo
(
    id                    bigint auto_increment
        primary key,
    shelly_id             varchar(12)                               not null,
    grupo_anterior_id     int                                       null,
    grupo_nuevo_id        int                                       not null,
    fecha_cambio          timestamp(6) default CURRENT_TIMESTAMP(6) not null,
    motivo                text                                      null,
    registro_auditoria_id bigint                                    not null,
    fecha_creacion        timestamp(6) default CURRENT_TIMESTAMP(6) null
);

create table sem_mediciones
(
    id                 bigint auto_increment
        primary key,
    shelly_id          varchar(12)                                       not null,
    timestamp_local    timestamp(6)                                      not null,
    fase               enum ('A', 'B', 'C', 'TOTAL')                     not null,
    voltaje            decimal(10, 2)                                    null,
    corriente          decimal(10, 3)                                    null,
    potencia_activa    decimal(10, 2)                                    null,
    potencia_aparente  decimal(10, 2)                                    null,
    factor_potencia    decimal(5, 3)                                     null,
    frecuencia         decimal(6, 2)                                     null,
    energia_activa     decimal(15, 3)                                    null,
    energia_reactiva   decimal(15, 3)                                    null,
    calidad_lectura    enum ('NORMAL', 'ALERTA', 'ERROR', 'INTERPOLADA') not null,
    validacion_detalle json                                              null,
    intervalo_segundos int          default 10                           null,
    fecha_creacion     timestamp(6) default CURRENT_TIMESTAMP(6)         null,
    constraint sem_mediciones_ibfk_1
        foreign key (shelly_id) references sem_dispositivos (shelly_id)
)
    comment 'Mediciones eléctricas detalladas' collate = utf8mb4_unicode_ci;


create table sem_promedios_dia
(
    id                              bigint auto_increment
        primary key,
    shelly_id                       varchar(12)                         not null,
    fecha_local                     date                                not null,
    fase_a_voltaje_promedio         decimal(10, 2)                      null,
    fase_a_corriente_promedio       decimal(10, 3)                      null,
    fase_a_potencia_promedio        decimal(10, 2)                      null,
    fase_a_factor_potencia_promedio decimal(5, 3)                       null,
    fase_b_voltaje_promedio         decimal(10, 2)                      null,
    fase_b_corriente_promedio       decimal(10, 3)                      null,
    fase_b_potencia_promedio        decimal(10, 2)                      null,
    fase_b_factor_potencia_promedio decimal(5, 3)                       null,
    fase_c_voltaje_promedio         decimal(10, 2)                      null,
    fase_c_corriente_promedio       decimal(10, 3)                      null,
    fase_c_potencia_promedio        decimal(10, 2)                      null,
    fase_c_factor_potencia_promedio decimal(5, 3)                       null,
    potencia_activa_promedio        decimal(10, 2)                      null,
    potencia_aparente_promedio      decimal(10, 2)                      null,
    factor_potencia_promedio        decimal(5, 3)                       null,
    horas_con_datos                 int                                 not null,
    lecturas_esperadas              int                                 not null,
    lecturas_recibidas              int                                 not null,
    lecturas_validas                int                                 not null,
    calidad_datos                   decimal(5, 2)                       null,
    fecha_creacion                  timestamp default CURRENT_TIMESTAMP not null,
    fecha_actualizacion             timestamp default CURRENT_TIMESTAMP not null on update CURRENT_TIMESTAMP,
    constraint sem_promedios_dia_ibfk_1
        foreign key (shelly_id) references sem_dispositivos (shelly_id)
)
    comment 'Promedios diarios de mediciones eléctricas' collate = utf8mb4_unicode_ci;

create table sem_promedios_hora
(
    id                              bigint auto_increment  primary key,
    shelly_id                       varchar(12)                         not null,
    hora_local                      timestamp(6)                        not null,
    fase_a_voltaje_promedio         decimal(10, 2)                      null,
    fase_a_corriente_promedio       decimal(10, 3)                      null,
    fase_a_potencia_activa_promedio decimal(10, 2)                      null,
    fase_a_factor_potencia_promedio decimal(5, 3)                       null,
    fase_b_voltaje_promedio         decimal(10, 2)                      null,
    fase_b_corriente_promedio       decimal(10, 3)                      null,
    fase_b_potencia_activa_promedio decimal(10, 2)                      null,
    fase_b_factor_potencia_promedio decimal(5, 3)                       null,
    fase_c_voltaje_promedio         decimal(10, 2)                      null,
    fase_c_corriente_promedio       decimal(10, 3)                      null,
    fase_c_potencia_activa_promedio decimal(10, 2)                      null,
    fase_c_factor_potencia_promedio decimal(5, 3)                       null,
    potencia_activa_promedio        decimal(10, 2)                      null,
    potencia_aparente_promedio      decimal(10, 2)                      null,
    factor_potencia_promedio        decimal(5, 3)                       null,
    lecturas_esperadas              int                                 not null,
    lecturas_recibidas              int                                 not null,
    lecturas_validas                int                                 not null,
    calidad_datos                   decimal(5, 2)                       null,
    fecha_creacion                  timestamp default CURRENT_TIMESTAMP not null,
    fecha_actualizacion             timestamp default CURRENT_TIMESTAMP not null on update CURRENT_TIMESTAMP,
    constraint sem_promedios_hora_ibfk_1
        foreign key (shelly_id) references sem_dispositivos (shelly_id)
)
    comment 'Promedios horarios de mediciones eléctricas' collate = utf8mb4_unicode_ci;


create table sem_promedios_mes
(
    id                              bigint auto_increment primary key,
    shelly_id                       varchar(12)                         not null,
    angio                             int                                 not null,
    mes                             int                                 not null,
    fase_a_voltaje_promedio         decimal(10, 2)                      null,
    fase_a_corriente_promedio       decimal(10, 3)                      null,
    fase_a_potencia_promedio        decimal(10, 2)                      null,
    fase_a_factor_potencia_promedio decimal(5, 3)                       null,
    fase_b_voltaje_promedio         decimal(10, 2)                      null,
    fase_b_corriente_promedio       decimal(10, 3)                      null,
    fase_b_potencia_promedio        decimal(10, 2)                      null,
    fase_b_factor_potencia_promedio decimal(5, 3)                       null,
    fase_c_voltaje_promedio         decimal(10, 2)                      null,
    fase_c_corriente_promedio       decimal(10, 3)                      null,
    fase_c_potencia_promedio        decimal(10, 2)                      null,
    fase_c_factor_potencia_promedio decimal(5, 3)                       null,
    potencia_activa_promedio        decimal(10, 2)                      null,
    potencia_aparente_promedio      decimal(10, 2)                      null,
    factor_potencia_promedio        decimal(5, 3)                       null,
    dias_con_datos                  int                                 not null,
    horas_con_datos                 int                                 not null,
    lecturas_esperadas              int                                 not null,
    lecturas_recibidas              int                                 not null,
    lecturas_validas                int                                 not null,
    calidad_datos                   decimal(5, 2)                       null,
    fecha_creacion                  timestamp default CURRENT_TIMESTAMP not null,
    fecha_actualizacion             timestamp default CURRENT_TIMESTAMP not null on update CURRENT_TIMESTAMP,
    constraint idx_angio_mes_dispositivo
        unique (shelly_id, angio, mes),
    constraint sem_promedios_mes_ibfk_1
        foreign key (shelly_id) references sem_dispositivos (shelly_id)
)
    comment 'Promedios mensuales de mediciones eléctricas' collate = utf8mb4_unicode_ci;




create table sem_registro_auditoria
(
    id             bigint auto_increment
        primary key,
    tipo_evento_id int                                       not null,
    shelly_id      varchar(12)                               null,
    grupo_id       int                                       null,
    usuario_id     varchar(100)                              null,
    fecha_evento   timestamp(6) default CURRENT_TIMESTAMP(6) not null,
    descripcion    text                                      not null,
    detalles       json                                      null,
    direccion_ip   varchar(45)                               null,
    fecha_creacion timestamp(6) default CURRENT_TIMESTAMP(6) null
)
    collate = utf8mb4_unicode_ci;



create table sem_tipos_parametros
(
    id                  int auto_increment
        primary key,
    nombre              varchar(50)                                             not null,
    descripcion         text                                                    null,
    tipo_dato           enum ('ENTERO', 'DECIMAL', 'TEXTO', 'BOOLEANO', 'JSON') not null,
    reglas_validacion   json                                                    null,
    fecha_creacion      timestamp default CURRENT_TIMESTAMP                     null,
    fecha_actualizacion timestamp default CURRENT_TIMESTAMP                     null on update CURRENT_TIMESTAMP,
    constraint idx_tipo_parametro_nombre
        unique (nombre)
)
    comment 'Catálogo de tipos de parámetros del sistema' collate = utf8mb4_unicode_ci;

create table sem_totales_dia
(
    id                      bigint auto_increment
        primary key,
    shelly_id               varchar(12)                         not null,
    fecha_local             date                                not null,
    fase_a_energia_activa   decimal(15, 3)                      null,
    fase_a_energia_reactiva decimal(15, 3)                      null,
    fase_b_energia_activa   decimal(15, 3)                      null,
    fase_b_energia_reactiva decimal(15, 3)                      null,
    fase_c_energia_activa   decimal(15, 3)                      null,
    fase_c_energia_reactiva decimal(15, 3)                      null,
    energia_activa_total    decimal(15, 3)                      not null,
    energia_reactiva_total  decimal(15, 3)                      null,
    potencia_maxima         decimal(10, 2)                      null,
    potencia_minima         decimal(10, 2)                      null,
    precio_kwh_promedio     decimal(10, 2)                      not null,
    costo_total             decimal(15, 2)                      not null,
    horas_con_datos         int                                 not null,
    fecha_creacion          timestamp default CURRENT_TIMESTAMP not null,
    fecha_actualizacion     timestamp default CURRENT_TIMESTAMP not null on update CURRENT_TIMESTAMP
)
    comment 'Totales diarios de consumo energético' collate = utf8mb4_unicode_ci;



create table sem_totales_hora
(
    id                      bigint auto_increment        primary key,
    shelly_id               varchar(12)                         not null,
    hora_local              timestamp(6)                        not null,
    fase_a_energia_activa   decimal(15, 3)                      null,
    fase_a_energia_reactiva decimal(15, 3)                      null,
    fase_b_energia_activa   decimal(15, 3)                      null,
    fase_b_energia_reactiva decimal(15, 3)                      null,
    fase_c_energia_activa   decimal(15, 3)                      null,
    fase_c_energia_reactiva decimal(15, 3)                      null,
    energia_activa_total    decimal(15, 3)                      not null,
    energia_reactiva_total  decimal(15, 3)                      null,
    potencia_maxima         decimal(10, 2)                      null,
    potencia_minima         decimal(10, 2)                      null,
    precio_kwh_periodo      decimal(10, 2)                      not null,
    costo_total             decimal(15, 2)                      not null,
    lecturas_validas        int                                 not null,
    calidad_datos           decimal(5, 2)                       null,
    fecha_creacion          timestamp default CURRENT_TIMESTAMP not null,
    fecha_actualizacion     timestamp default CURRENT_TIMESTAMP not null on update CURRENT_TIMESTAMP
)
    comment 'Totales horarios de consumo energético' collate = utf8mb4_unicode_ci;


create table sem_totales_mes
(
    id                      bigint auto_increment
        primary key,
    shelly_id               varchar(12)                         not null,
    año                     int                                 not null,
    mes                     int                                 not null,
    fase_a_energia_activa   decimal(15, 3)                      null,
    fase_a_energia_reactiva decimal(15, 3)                      null,
    fase_b_energia_activa   decimal(15, 3)                      null,
    fase_b_energia_reactiva decimal(15, 3)                      null,
    fase_c_energia_activa   decimal(15, 3)                      null,
    fase_c_energia_reactiva decimal(15, 3)                      null,
    energia_activa_total    decimal(15, 3)                      not null,
    energia_reactiva_total  decimal(15, 3)                      null,
    potencia_maxima         decimal(10, 2)                      null,
    potencia_minima         decimal(10, 2)                      null,
    precio_kwh_promedio     decimal(10, 2)                      not null,
    costo_total             decimal(15, 2)                      not null,
    dias_con_datos          int                                 not null,
    horas_con_datos         int                                 not null,
    fecha_creacion          timestamp default CURRENT_TIMESTAMP not null,
    fecha_actualizacion     timestamp default CURRENT_TIMESTAMP not null on update CURRENT_TIMESTAMP,
    constraint idx_año_mes_dispositivo
        unique (shelly_id, año, mes)
)
    comment 'Totales mensuales de consumo energético' collate = utf8mb4_unicode_ci;