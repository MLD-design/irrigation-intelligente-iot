
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
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/measurements")
public class MeasurementController {

    private final MeasurementRepository measurementRepository;
    private final DeviceKeyValidator deviceKeyValidator;
    private final IrrigationAutomationService automationService;
    private final IrrigationAlertService alertService;
    private final IrrigationSettingsRepository settingsRepository;

    public MeasurementController(
            MeasurementRepository measurementRepository,
            DeviceKeyValidator deviceKeyValidator,
            IrrigationAutomationService automationService,
            IrrigationAlertService alertService,
            IrrigationSettingsRepository settingsRepository) {

        this.measurementRepository = measurementRepository;
        this.deviceKeyValidator = deviceKeyValidator;
        this.automationService = automationService;
        this.alertService = alertService;
        this.settingsRepository = settingsRepository;
    }

    @GetMapping("/history")
    public ResponseEntity<?> getMeasurementHistory(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(required = false) String deviceId,
            @RequestParam(required = false) OffsetDateTime from,
            @RequestParam(required = false) OffsetDateTime to) {

        if (page < 0 || size < 1 || size > 100) {
            return ResponseEntity.badRequest().body(
                    Map.of("error",
                            "Le numéro de page doit être positif ou nul et la taille comprise entre 1 et 100."));
        }

        if (from != null && to != null && from.isAfter(to)) {
            return ResponseEntity.badRequest().body(
                    Map.of("error",
                            "La date de début doit être antérieure ou égale à la date de fin."));
        }

        Pageable pageable = PageRequest.of(page, size);

        boolean hasDevice =
                deviceId != null && !deviceId.isBlank();

        String normalizedDeviceId =
                hasDevice ? deviceId.trim() : null;

        Page<Measurement> measurements;

        if (hasDevice && from != null && to != null) {
            measurements =
                    measurementRepository
                            .findByDeviceIdAndMeasuredAtBetweenOrderByMeasuredAtDesc(
                                    normalizedDeviceId, from, to, pageable);

        } else if (hasDevice && from != null) {
            measurements =
                    measurementRepository
                            .findByDeviceIdAndMeasuredAtGreaterThanEqualOrderByMeasuredAtDesc(
                                    normalizedDeviceId, from, pageable);

        } else if (hasDevice && to != null) {
            measurements =
                    measurementRepository
                            .findByDeviceIdAndMeasuredAtLessThanEqualOrderByMeasuredAtDesc(
                                    normalizedDeviceId, to, pageable);

        } else if (from != null && to != null) {
            measurements =
                    measurementRepository
                            .findByMeasuredAtBetweenOrderByMeasuredAtDesc(
                                    from, to, pageable);

        } else if (from != null) {
            measurements =
                    measurementRepository
                            .findByMeasuredAtGreaterThanEqualOrderByMeasuredAtDesc(
                                    from, pageable);

        } else if (to != null) {
            measurements =
                    measurementRepository
                            .findByMeasuredAtLessThanEqualOrderByMeasuredAtDesc(
                                    to, pageable);

        } else if (hasDevice) {
            measurements =
                    measurementRepository
                            .findByDeviceIdOrderByMeasuredAtDesc(
                                    normalizedDeviceId, pageable);

        } else {
            measurements =
                    measurementRepository
                            .findAllByOrderByMeasuredAtDesc(pageable);
        }

        return ResponseEntity.ok(measurements);
    }

    @GetMapping("/latest")
    public ResponseEntity<?> getLatestMeasurement(
            @RequestParam(required = false) String deviceId) {

        Optional<Measurement> measurement;

        if (deviceId != null && !deviceId.isBlank()) {
            measurement =
                    measurementRepository
                            .findTopByDeviceIdOrderByMeasuredAtDesc(
                                    deviceId.trim());
        } else {
            measurement =
                    measurementRepository.findTopByOrderByMeasuredAtDesc();
        }

        if (measurement.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(Map.of("error", "Aucune mesure disponible."));
        }

        return ResponseEntity.ok(measurement.get());
    }

    @PostMapping
    public ResponseEntity<?> createMeasurement(
            @RequestHeader(
                    value = "X-Device-Key",
                    required = false)
            String deviceKey,
            @RequestBody Measurement measurement) {

        if (!deviceKeyValidator.isValid(deviceKey)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error",
                            "Clé du dispositif invalide ou absente."));
        }

        if (measurement.getDeviceId() == null
                || measurement.getDeviceId().isBlank()) {
            return ResponseEntity.badRequest().body(
                    Map.of("error", "deviceId est obligatoire."));
        }

        if (measurement.getSoilMoisture() == null
                || measurement.getSoilMoisture() < 0
                || measurement.getSoilMoisture() > 100) {
            return ResponseEntity.badRequest().body(
                    Map.of("error",
                            "soilMoisture doit être compris entre 0 et 100."));
        }

        if (measurement.getMeasuredAt() == null) {
            return ResponseEntity.badRequest().body(
                    Map.of("error", "measuredAt est obligatoire."));
        }

        measurement.setDeviceId(measurement.getDeviceId().trim());
        measurement.setReceivedAt(
                OffsetDateTime.now(ZoneOffset.UTC));

        Measurement savedMeasurement =
                measurementRepository.save(measurement);

        IrrigationSettings settings =
                settingsRepository.findById(1L)
                        .orElseGet(() -> settingsRepository.save(
                                new IrrigationSettings()));

        // Générer ou actualiser les alertes indépendamment
        // du mode automatique.
        alertService.evaluateMeasurement(
                savedMeasurement.getDeviceId(),
                savedMeasurement.getSoilMoisture(),
                settings.getMoistureThreshold());

        // Conserver l'automatisation existante de la pompe.
        automationService.evaluateMeasurement(
                savedMeasurement.getSoilMoisture());

        return ResponseEntity.status(HttpStatus.CREATED)
                .body(savedMeasurement);
    }
}
