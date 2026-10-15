
package sn.irrigation.backend;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

@Repository
public interface MeasurementRepository extends JpaRepository<Measurement, Long> {
    Optional<Measurement> findTopByOrderByMeasuredAtDesc();
    Page<Measurement> findAllByOrderByMeasuredAtDesc(Pageable pageable);
}

