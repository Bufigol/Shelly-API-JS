CREATE TABLE `teltonika`.`catalogo_ubicaciones_reales` (
  `idcatalogo_ubicaciones_reales` INT NOT NULL,
  `nombre_ubicacion` VARCHAR(45) NOT NULL,
  PRIMARY KEY (`idcatalogo_ubicaciones_reales`));

ALTER TABLE `teltonika`.`catalogo_ubicaciones_reales` 
CHANGE COLUMN `idcatalogo_ubicaciones_reales` `idcatalogo_ubicaciones_reales` INT NOT NULL AUTO_INCREMENT ;


ALTER TABLE `teltonika`.`sem_dispositivos` 
CHANGE COLUMN `ubicacion` `ubicacion` INT NOT NULL ,
ADD INDEX `fk_ubicacion_real_sem_idx` (`ubicacion` ASC) VISIBLE;
;
ALTER TABLE `teltonika`.`sem_dispositivos` 
ADD CONSTRAINT `fk_ubicacion_real_sem`
  FOREIGN KEY (`ubicacion`)
  REFERENCES `teltonika`.`catalogo_ubicaciones_reales` (`idcatalogo_ubicaciones_reales`)
  ON DELETE NO ACTION
  ON UPDATE NO ACTION;

  ALTER TABLE `teltonika`.`sem_dispositivos` 
DROP FOREIGN KEY `fk_ubicacion_real_sem`;
ALTER TABLE `teltonika`.`sem_dispositivos` 
CHANGE COLUMN `ubicacion` `ubicacion` INT NOT NULL DEFAULT 1 ;
ALTER TABLE `teltonika`.`sem_dispositivos` 
ADD CONSTRAINT `fk_ubicacion_real_sem`
  FOREIGN KEY (`ubicacion`)
  REFERENCES `teltonika`.`catalogo_ubicaciones_reales` (`idcatalogo_ubicaciones_reales`);
