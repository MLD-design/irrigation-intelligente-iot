
package sn.irrigation.backend;

import java.util.List;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface IrrigationAlertRepository
        extends JpaRepository<IrrigationAlert, Long> {

    Page<IrrigationAlert> findAllByOrderByCreatedAtDesc(
            Pageable pageable);

    Page<IrrigationAlert> findByAcknowledgedOrderByCreatedAtDesc(
            boolean acknowledged,
            Pageable pageable);

    Page<IrrigationAlert> findBySeverityIgnoreCaseOrderByCreatedAtDesc(
            String severity,
            Pageable pageable);

    Page<IrrigationAlert> findByAcknowledgedAndSeverityIgnoreCaseOrderByCreatedAtDesc(
            boolean acknowledged,
            String severity,
            Pageable pageable);

    List<IrrigationAlert> findTop20ByDeviceIdAndTypeAndAcknowledgedFalseOrderByCreatedAtDesc(
            String deviceId,
            String type);
}
