
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

        // Les commandes simulees ne definissent pas l'etat physique.
        boolean pumpOn = commands.stream()
                .filter(command ->
                        !command.isSimulated()
                        && "EXECUTED".equals(command.getStatus())
                        && ("START".equals(command.getAction())
                        || "STOP".equals(command.getAction())))
                .findFirst()
                .map(command -> "START".equals(command.getAction()))
                .orElse(false);

        // Les commandes simulees ne doivent pas bloquer l'automatisation.
        boolean commandNotDelivered = commands.stream()
                .anyMatch(command ->
                        !command.isSimulated()
                        && "PENDING".equals(command.getStatus())
                        && command.getDeliveredAt() == null
                        && ("START".equals(command.getAction())
                        || "STOP".equals(command.getAction())));

        boolean commandAlreadyDelivered = commands.stream()
                .anyMatch(command ->
                        !command.isSimulated()
                        && "PENDING".equals(command.getStatus())
                        && command.getDeliveredAt() != null
                        && ("START".equals(command.getAction())
                        || "STOP".equals(command.getAction())));

        String action = null;

        if (soilMoisture < threshold && !pumpOn) {
            action = "START";
        } else if (soilMoisture >= threshold && pumpOn) {
            action = "STOP";
        }

        // Attendre le resultat d'une commande physique deja livree.
        if (commandAlreadyDelivered) {
            return;
        }

        // Adapter ou expirer une commande physique pas encore livree.
        if (commandNotDelivered) {
            IrrigationCommand pendingCommand = commands.stream()
                    .filter(command ->
                            !command.isSimulated()
                            && "PENDING".equals(command.getStatus())
                            && command.getDeliveredAt() == null
                            && ("START".equals(command.getAction())
                            || "STOP".equals(command.getAction())))
                    .findFirst()
                    .orElse(null);

            if (pendingCommand != null) {
                if (action == null) {
                    pendingCommand.setStatus("EXPIRED");
                    pendingCommand.setCompletedAt(
                            OffsetDateTime.now(ZoneOffset.UTC));
                    pendingCommand.setMessage(
                            "Commande annulee : la mesure actuelle "
                            + "ne necessite plus cette action.");
                    commandRepository.save(pendingCommand);
                    return;
                }

                pendingCommand.setAction(action);
                pendingCommand.setSource("AUTOMATIC");
                pendingCommand.setMessage(
                        "Commande automatique : humidite = "
                        + soilMoisture + " %, seuil = "
                        + threshold + " %");
                commandRepository.save(pendingCommand);
                return;
            }
        }

        if (action == null) {
            return;
        }

        IrrigationCommand command = new IrrigationCommand();
        command.setAction(action);
        command.setSource("AUTOMATIC");
        command.setStatus("PENDING");
        command.setSimulated(false);
        command.setMessage(
                "Commande automatique : humidite = "
                + soilMoisture + " %, seuil = "
                + threshold + " %");

        commandRepository.save(command);
    }
}
