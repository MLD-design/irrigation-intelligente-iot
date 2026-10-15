
package sn.irrigation.backend;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Map;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/irrigation")
public class IrrigationStatusController {

    private final IrrigationCommandRepository repository;
    private final IrrigationSettingsRepository settingsRepository;

    public IrrigationStatusController(
            IrrigationCommandRepository repository,
            IrrigationSettingsRepository settingsRepository) {
        this.repository = repository;
        this.settingsRepository = settingsRepository;
    }

    @GetMapping("/status")
    public ResponseEntity<Map<String, Object>> getStatus() {

        var latestCommand = repository.findTop20ByOrderByCreatedAtDesc()
                .stream()
                .filter(command ->
                        "EXECUTED".equals(command.getStatus())
                        && ("START".equals(command.getAction())
                        || "STOP".equals(command.getAction())))
                .findFirst();

        String pumpState = latestCommand
                .map(command -> "START".equals(command.getAction())
                        ? "ON" : "OFF")
                .orElse("UNKNOWN");

        IrrigationSettings settings = settingsRepository.findById(1L)
                .orElseGet(IrrigationSettings::new);

        String mode = Boolean.TRUE.equals(
                settings.getAutomaticModeEnabled())
                ? "AUTOMATIC" : "MANUAL";

        return ResponseEntity.ok(Map.of(
                "pumpState", pumpState,
                "mode", mode,
                "updatedAt", OffsetDateTime.now(ZoneOffset.UTC)
        ));
    }
}
