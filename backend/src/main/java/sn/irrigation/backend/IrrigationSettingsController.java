
package sn.irrigation.backend;

import java.util.Map;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/settings")
public class IrrigationSettingsController {

    private final IrrigationSettingsRepository repository;

    public IrrigationSettingsController(
            IrrigationSettingsRepository repository) {
        this.repository = repository;
    }

    @GetMapping
    public IrrigationSettings getSettings() {
        return repository.findById(1L)
                .orElseGet(() -> repository.save(new IrrigationSettings()));
    }

    @PutMapping
    public ResponseEntity<?> updateSettings(
            @RequestBody IrrigationSettings input) {

        if (input.getMoistureThreshold() == null
                || input.getMoistureThreshold() < 0
                || input.getMoistureThreshold() > 100
                || input.getAutomaticModeEnabled() == null) {
            return ResponseEntity.badRequest().body(
                    Map.of("error",
                            "Le seuil doit être compris entre 0 et 100 et le mode doit être renseigné"));
        }

        IrrigationSettings settings = repository.findById(1L)
                .orElseGet(IrrigationSettings::new);

        settings.setMoistureThreshold(input.getMoistureThreshold());
        settings.setAutomaticModeEnabled(input.getAutomaticModeEnabled());

        return ResponseEntity.ok(repository.save(settings));
    }
}
