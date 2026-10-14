
package sn.irrigation.backend;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Map;
import java.util.Set;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/irrigation")
public class IrrigationCommandController {

    private final IrrigationCommandRepository repository;

    public IrrigationCommandController(
            IrrigationCommandRepository repository) {
        this.repository = repository;
    }

    // Créer une commande START ou STOP
    @PostMapping("/commands")
    public ResponseEntity<?> createCommand(
            @RequestBody Map<String, String> body) {

        String action = body.get("action");
        String source = body.get("source");

        if (!Set.of("START", "STOP").contains(action)
                || !Set.of("MANUAL", "AUTOMATIC").contains(source)) {
            return ResponseEntity.badRequest().body(
                Map.of("error",
                    "action doit être START ou STOP et source MANUAL ou AUTOMATIC")
            );
        }

        IrrigationCommand command = new IrrigationCommand();
        command.setAction(action);
        command.setSource(source);

        IrrigationCommand saved = repository.save(command);

        return ResponseEntity.status(HttpStatus.ACCEPTED).body(saved);
    }

    // Consulter une commande par son identifiant
    @GetMapping("/commands/{commandId}")
    public ResponseEntity<?> getCommand(
            @PathVariable String commandId) {

        return repository.findById(commandId)
                .<ResponseEntity<?>>map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    // Historique paginé des commandes
    @GetMapping("/history")
    public ResponseEntity<?> getHistory(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {

        if (page < 0 || size < 1 || size > 100) {
            return ResponseEntity.badRequest().body(
                Map.of("error", "page doit être positif et size compris entre 1 et 100")
            );
        }

        Pageable pageable = PageRequest.of(page, size);
        Page<IrrigationCommand> history =
                repository.findAllByOrderByCreatedAtDesc(pageable);

        return ResponseEntity.ok(history);
    }

    

}

