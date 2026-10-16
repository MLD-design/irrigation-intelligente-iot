
package sn.irrigation.backend;

import java.time.OffsetDateTime;
import java.util.Optional;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface MeasurementRepository
        extends JpaRepository<Measurement, Long> {

    Optional<Measurement> findTopByOrderByMeasuredAtDesc();

    Page<Measurement> findAllByOrderByMeasuredAtDesc(
            Pageable pageable);

    Page<Measurement> findByDeviceIdAndMeasuredAtBetweenOrderByMeasuredAtDesc(
            String deviceId,
            OffsetDateTime from,
            OffsetDateTime to,
            Pageable pageable);

    Page<Measurement> findByDeviceIdAndMeasuredAtGreaterThanEqualOrderByMeasuredAtDesc(
            String deviceId,
            OffsetDateTime from,
            Pageable pageable);

    Page<Measurement> findByDeviceIdAndMeasuredAtLessThanEqualOrderByMeasuredAtDesc(
            String deviceId,
            OffsetDateTime to,
            Pageable pageable);

    Page<Measurement> findByMeasuredAtBetweenOrderByMeasuredAtDesc(
            OffsetDateTime from,
            OffsetDateTime to,
            Pageable pageable);

    Page<Measurement> findByMeasuredAtGreaterThanEqualOrderByMeasuredAtDesc(
            OffsetDateTime from,
            Pageable pageable);

    Page<Measurement> findByMeasuredAtLessThanEqualOrderByMeasuredAtDesc(
            OffsetDateTime to,
            Pageable pageable);

    Page<Measurement> findByDeviceIdOrderByMeasuredAtDesc(
            String deviceId,
            Pageable pageable);

    Optional<Measurement> findTopByDeviceIdOrderByMeasuredAtDesc(
        String deviceId);
}
