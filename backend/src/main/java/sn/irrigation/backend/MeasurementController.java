
package sn.irrigation.backend;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Map;
import java.util.Optional;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/measurements")
public class MeasurementController {

    private final MeasurementRepository measurementRepository;
    private final DeviceKeyValidator deviceKeyValidator;
    private final IrrigationAutomationService automationService;

    public MeasurementController(
            MeasurementRepository measurementRepository,
            DeviceKeyValidator deviceKeyValidator,
            IrrigationAutomationService automationService) {
        this.measurementRepository = measurementRepository;
        this.deviceKeyValidator = deviceKeyValidator;
        this.automationService = automationService;
    }

    @GetMapping("/history")
    public ResponseEntity<Page<Measurement>> getMeasurementHistory(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {

        if (page < 0 || size < 1 || size > 100) {
            return ResponseEntity.badRequest().build();
        }

        Pageable pageable = PageRequest.of(page, size);

        Page<Measurement> measurements =
                measurementRepository.findAllByOrderByMeasuredAtDesc(pageable);

        return ResponseEntity.ok(measurements);
    }

    @GetMapping("/latest")
    public ResponseEntity<?> getLatestMeasurement() {

        Optional<Measurement> measurement =
                measurementRepository.findTopByOrderByMeasuredAtDesc();

        if (measurement.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(Map.of("error", "Aucune mesure disponible"));
        }

        return ResponseEntity.ok(measurement.get());
    }

    @PostMapping
    public ResponseEntity<?> createMeasurement(
            @RequestHeader(value = "X-Device-Key", required = false)
            String deviceKey,
            @RequestBody Measurement measurement) {

        if (!deviceKeyValidator.isValid(deviceKey)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "Clé du dispositif invalide ou absente"));
        }

        if (measurement.getDeviceId() == null
                || measurement.getDeviceId().isBlank()) {
            return ResponseEntity.badRequest().body(
                    Map.of("error", "deviceId est obligatoire"));
        }

        if (measurement.getSoilMoisture() == null
                || measurement.getSoilMoisture() < 0
                || measurement.getSoilMoisture() > 100) {
            return ResponseEntity.badRequest().body(
                    Map.of("error", "soilMoisture doit être compris entre 0 et 100"));
        }

        if (measurement.getMeasuredAt() == null) {
            return ResponseEntity.badRequest().body(
                    Map.of("error", "measuredAt est obligatoire"));
        }

        measurement.setReceivedAt(OffsetDateTime.now(ZoneOffset.UTC));

        Measurement savedMeasurement =
                measurementRepository.save(measurement);

        automationService.evaluateMeasurement(
                savedMeasurement.getSoilMoisture());

        return ResponseEntity.status(HttpStatus.CREATED)
                .body(savedMeasurement);
    }
}
