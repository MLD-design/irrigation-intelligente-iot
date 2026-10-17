
package sn.irrigation.backend;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class IrrigationAutomationService {

    private final IrrigationSettingsRepository settingsRepository;
    private final IrrigationCommandRepository commandRepository;

    public IrrigationAutomationService(
            IrrigationSettingsRepository settingsRepository,
            IrrigationCommandRepository commandRepository) {
        this.settingsRepository = settingsRepository;
        this.commandRepository = commandRepository;
    }

    @Transactional
    public void evaluateMeasurement(Double soilMoisture) {

        if (soilMoisture == null
                || soilMoisture < 0
                || soilMoisture > 100) {
            return;
        }

        IrrigationSettings settings = settingsRepository.findById(1L)
                .orElseGet(() -> settingsRepository.save(
                        new IrrigationSettings()));

        // En mode manuel, aucune commande automatique n'est creee.
        if (!Boolean.TRUE.equals(settings.getAutomaticModeEnabled())) {
            return;
        }

        Double configuredThreshold = settings.getMoistureThreshold();

        if (configuredThreshold == null
                || configuredThreshold < 0
                || configuredThreshold > 100) {
            return;
        }

        double threshold = configuredThreshold;

        List<IrrigationCommand> commands =
                commandRepository.findTop20ByOrderByCreatedAtDesc();

        // Derniere commande START/STOP executee, simulation comprise.
        boolean pumpOn = commands.stream()
                .filter(command ->
                        "EXECUTED".equals(command.getStatus())
                        && ("START".equals(command.getAction())
                        || "STOP".equals(command.getAction())))
                .findFirst()
                .map(command -> "START".equals(command.getAction()))
                .orElse(false);

        // Une commande deja livree doit recevoir son resultat avant
        // qu'une nouvelle commande automatique soit creee.
        boolean commandAlreadyDelivered = commands.stream()
                .anyMatch(command ->
                        "PENDING".equals(command.getStatus())
                        && command.getDeliveredAt() != null
                        && ("START".equals(command.getAction())
                        || "STOP".equals(command.getAction())));

        if (commandAlreadyDelivered) {
            return;
        }

        // Recherche d'une commande automatique encore en attente.
        IrrigationCommand pendingCommand = commands.stream()
                .filter(command ->
                        "AUTOMATIC".equals(command.getSource())
                        && "PENDING".equals(command.getStatus())
                        && command.getDeliveredAt() == null
                        && ("START".equals(command.getAction())
                        || "STOP".equals(command.getAction())))
                .findFirst()
                .orElse(null);

        String action = null;

        if (soilMoisture < threshold && !pumpOn) {
            action = "START";
        } else if (soilMoisture >= threshold && pumpOn) {
            action = "STOP";
        }

        // Si une commande automatique attend encore sa livraison,
        // on l'adapte a la mesure actuelle ou on l'annule.
        if (pendingCommand != null) {

            if (action == null) {
                pendingCommand.setStatus("EXPIRED");
                pendingCommand.setCompletedAt(
                        OffsetDateTime.now(ZoneOffset.UTC));
                pendingCommand.setMessage(
                        "Commande automatique annulee : "
                        + "la mesure actuelle ne necessite plus cette action.");
            } else {
                pendingCommand.setAction(action);
                pendingCommand.setMessage(
                        "Commande automatique : humidite = "
                        + soilMoisture + " %, seuil = "
                        + threshold + " %.");
            }

            commandRepository.save(pendingCommand);
            return;
        }

        if (action == null) {
            return;
        }

        IrrigationCommand command = new IrrigationCommand();
        command.setAction(action);
        command.setSource("AUTOMATIC");
        command.setStatus("PENDING");

        // La commande est destinee au firmware actuellement en simulation.
        // Le resultat du firmware indiquera ensuite si elle a ete simulee.
        command.setSimulated(true);

        command.setMessage(
                "Commande automatique simulee : humidite = "
                + soilMoisture + " %, seuil = "
                + threshold + " %.");

        commandRepository.save(command);
    }
}
