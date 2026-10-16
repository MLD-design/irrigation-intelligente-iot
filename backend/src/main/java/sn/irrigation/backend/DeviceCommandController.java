
package sn.irrigation.backend;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Map;
import java.util.Set;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

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
                    .body(Map.of(
                            "error",
                            "Cle du dispositif invalide ou absente"));
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
            @RequestBody Map<String, Object> body) {

        if (!deviceKeyValidator.isValid(deviceKey)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of(
                            "error",
                            "Cle du dispositif invalide ou absente"));
        }

        Object statusValue = body.get("status");
        Object simulatedValue = body.get("simulated");
        Object messageValue = body.get("message");

        if (!(statusValue instanceof String status)
                || !Set.of("EXECUTED", "REJECTED", "FAILED")
                        .contains(status)) {
            return ResponseEntity.badRequest().body(
                    Map.of("error", "Statut invalide"));
        }

        if (simulatedValue != null
                && !(simulatedValue instanceof Boolean)) {
            return ResponseEntity.badRequest().body(
                    Map.of("error", "Le champ simulated doit etre booleen"));
        }

        if (messageValue != null
                && !(messageValue instanceof String)) {
            return ResponseEntity.badRequest().body(
                    Map.of("error", "Le champ message doit etre une chaine"));
        }

        boolean simulated = Boolean.TRUE.equals(simulatedValue);
        String message = (String) messageValue;

        return repository.findById(commandId)
                .<ResponseEntity<?>>map(command -> {
                    command.setStatus(status);
                    command.setSimulated(simulated);
                    command.setMessage(message);
                    command.setCompletedAt(
                            OffsetDateTime.now(ZoneOffset.UTC));

                    return ResponseEntity.ok(repository.save(command));
                })
                .orElseGet(() -> ResponseEntity.notFound().build());
    }
}
