
package sn.irrigation.backend;

import org.springframework.data.jpa.repository.JpaRepository;

public interface IrrigationSettingsRepository
        extends JpaRepository<IrrigationSettings, Long> {
}

