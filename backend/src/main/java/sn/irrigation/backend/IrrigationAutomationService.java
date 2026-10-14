
package sn.irrigation.backend;

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

        if (soilMoisture == null) {
            return;
        }

        IrrigationSettings settings = settingsRepository.findById(1L)
                .orElseGet(() -> settingsRepository.save(
                        new IrrigationSettings()));

        if (!Boolean.TRUE.equals(settings.getAutomaticModeEnabled())) {
            return;
        }

        double threshold = settings.getMoistureThreshold();

        List<IrrigationCommand> commands =
                commandRepository.findTop20ByOrderByCreatedAtDesc();

        // Chercher la dernière commande START ou STOP exécutée.
        boolean pumpOn = commands.stream()
                .filter(command ->
                        "EXECUTED".equals(command.getStatus())
                        && ("START".equals(command.getAction())
                        || "STOP".equals(command.getAction())))
                .findFirst()
                .map(command -> "START".equals(command.getAction()))
                .orElse(false);

        // Chercher une commande qui attend encore d'être transmise.
        boolean commandNotDelivered = commands.stream()
                .anyMatch(command ->
                        "PENDING".equals(command.getStatus())
                        && command.getDeliveredAt() == null
                        && ("START".equals(command.getAction())
                        || "STOP".equals(command.getAction())));

        // Une commande déjà transmise doit recevoir son résultat
        // avant que le backend ne crée un ordre contradictoire.
        boolean commandAlreadyDelivered = commands.stream()
                .anyMatch(command ->
                        "PENDING".equals(command.getStatus())
                        && command.getDeliveredAt() != null
                        && ("START".equals(command.getAction())
                        || "STOP".equals(command.getAction())));

        String action = null;

        if (soilMoisture < threshold && !pumpOn) {
            action = "START";
        } else if (soilMoisture >= threshold && pumpOn) {
            action = "STOP";
        }

    
        // Si une commande a déjà été transmise à l'ESP32,
        // on attend son résultat avant de créer une autre commande.
        if (commandAlreadyDelivered) {
            return;
        }

        // Rechercher une commande encore en attente de transmission.
        if (commandNotDelivered) {
            IrrigationCommand pendingCommand = commands.stream()
                    .filter(command ->
                            "PENDING".equals(command.getStatus())
                            && command.getDeliveredAt() == null
                            && ("START".equals(command.getAction())
                            || "STOP".equals(command.getAction())))
                    .findFirst()
                    .orElse(null);

            if (pendingCommand != null) {

                // Si aucune action n'est désormais nécessaire,
                // annuler l'ancienne commande en la marquant EXPIRED.
                if (action == null) {
                    pendingCommand.setStatus("EXPIRED");
                    pendingCommand.setCompletedAt(
                            java.time.OffsetDateTime.now(
                                    java.time.ZoneOffset.UTC));
                    pendingCommand.setMessage(
                            "Commande annulée : la dernière mesure ne nécessite plus cette action.");
                    commandRepository.save(pendingCommand);
                    return;
                }

                // Sinon, adapter la commande à la mesure actuelle.
                pendingCommand.setAction(action);
                pendingCommand.setSource("AUTOMATIC");
                pendingCommand.setMessage(
                        "Commande automatique : humidité = "
                        + soilMoisture + " %, seuil = " + threshold + " %");
                commandRepository.save(pendingCommand);
                return;
            }
        }

        // Aucune commande en attente et aucune action nécessaire.
        if (action == null) {
            return;
        }

        // Créer une nouvelle commande automatique.
        IrrigationCommand command = new IrrigationCommand();
        command.setAction(action);
        command.setSource("AUTOMATIC");
        command.setStatus("PENDING");
        command.setMessage(
                "Commande automatique : humidité = "
                + soilMoisture + " %, seuil = " + threshold + " %");

        commandRepository.save(command);
    }
}


