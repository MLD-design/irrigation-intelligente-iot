
package sn.irrigation.backend;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Map;
import java.util.Set;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/device/commands")
public class DeviceCommandController {

    private final IrrigationCommandRepository repository;
    private final DeviceKeyValidator deviceKeyValidator;

    public DeviceCommandController(
            IrrigationCommandRepository repository,
            DeviceKeyValidator deviceKeyValidator) {
        this.repository = repository;
        this.deviceKeyValidator = deviceKeyValidator;
    }

    @GetMapping("/next")
    public ResponseEntity<?> getNextCommand(
            @RequestHeader(value = "X-Device-Key", required = false)
            String deviceKey) {

        if (!deviceKeyValidator.isValid(deviceKey)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "Clé du dispositif invalide ou absente"));
        }

        return repository
                .findFirstByStatusAndDeliveredAtIsNullOrderByCreatedAtAsc(
                        "PENDING")
                .<ResponseEntity<?>>map(command -> {
                    command.setDeliveredAt(
                            OffsetDateTime.now(ZoneOffset.UTC));
                    return ResponseEntity.ok(repository.save(command));
                })
                .orElseGet(() -> ResponseEntity.noContent().build());
    }

    @PostMapping("/{commandId}/result")
    public ResponseEntity<?> reportResult(
            @RequestHeader(value = "X-Device-Key", required = false)
            String deviceKey,
            @PathVariable String commandId,
            @RequestBody Map<String, String> body) {

        if (!deviceKeyValidator.isValid(deviceKey)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "Clé du dispositif invalide ou absente"));
        }

        String status = body.get("status");

        if (status == null
                || !Set.of("EXECUTED", "REJECTED", "FAILED").contains(status)) {
            return ResponseEntity.badRequest().body(
                    Map.of("error", "Statut invalide"));
        }

        return repository.findById(commandId)
                .<ResponseEntity<?>>map(command -> {
                    command.setStatus(status);
                    command.setMessage(body.get("message"));
                    command.setCompletedAt(
                            OffsetDateTime.now(ZoneOffset.UTC));
                    return ResponseEntity.ok(repository.save(command));
                })
                .orElseGet(() -> ResponseEntity.notFound().build());
    }
}
