
package sn.irrigation.backend;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class IrrigationAlertService {

    private final IrrigationAlertRepository alertRepository;

    public IrrigationAlertService(
            IrrigationAlertRepository alertRepository) {
        this.alertRepository = alertRepository;
    }

    @Transactional(readOnly = true)
    public Page<IrrigationAlert> getAlerts(
            Boolean acknowledged,
            String severity,
            int page,
            int size) {

        if (page < 0) {
            throw new IllegalArgumentException(
                    "Le numéro de page doit être positif ou nul.");
        }

        if (size < 1 || size > 100) {
            throw new IllegalArgumentException(
                    "La taille de page doit être comprise entre 1 et 100.");
        }

        Pageable pageable = PageRequest.of(page, size);

        boolean filterSeverity =
                severity != null && !severity.isBlank();

        if (acknowledged != null && filterSeverity) {
            return alertRepository
                    .findByAcknowledgedAndSeverityIgnoreCaseOrderByCreatedAtDesc(
                            acknowledged, severity.trim(), pageable);
        }

        if (acknowledged != null) {
            return alertRepository
                    .findByAcknowledgedOrderByCreatedAtDesc(
                            acknowledged, pageable);
        }

        if (filterSeverity) {
            return alertRepository
                    .findBySeverityIgnoreCaseOrderByCreatedAtDesc(
                            severity.trim(), pageable);
        }

        return alertRepository.findAllByOrderByCreatedAtDesc(pageable);
    }

    @Transactional
    public IrrigationAlert acknowledgeAlert(Long alertId) {
        IrrigationAlert alert = alertRepository.findById(alertId)
                .orElseThrow(() -> new AlertNotFoundException(
                        "Alerte introuvable : " + alertId));

        if (!alert.isAcknowledged()) {
            alert.setAcknowledged(true);
            alert.setAcknowledgedAt(
                    OffsetDateTime.now(ZoneOffset.UTC));
        }

        return alertRepository.save(alert);
    }

    @Transactional
    public void evaluateMeasurement(
            String deviceId,
            Double soilMoisture,
            double threshold) {

        if (deviceId == null || deviceId.isBlank()
                || soilMoisture == null) {
            return;
        }

        List<IrrigationAlert> existingAlerts =
                alertRepository
                        .findTop20ByDeviceIdAndTypeAndAcknowledgedFalseOrderByCreatedAtDesc(
                                deviceId, "LOW_MOISTURE");

        if (soilMoisture < threshold) {
            if (existingAlerts.isEmpty()) {
                IrrigationAlert alert = new IrrigationAlert();
                alert.setDeviceId(deviceId);
                alert.setType("LOW_MOISTURE");
                alert.setSeverity("WARNING");
                alert.setMessage(
                        "Humidité du sol faible : "
                        + soilMoisture + " %, seuil : "
                        + threshold + " %.");

                alertRepository.save(alert);
            }
        } else {
            // Le problème est résolu : on acquitte les alertes
            // d'humidité faible encore ouvertes.
            OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);

            for (IrrigationAlert alert : existingAlerts) {
                alert.setAcknowledged(true);
                alert.setAcknowledgedAt(now);
            }

            alertRepository.saveAll(existingAlerts);
        }
    }
}
