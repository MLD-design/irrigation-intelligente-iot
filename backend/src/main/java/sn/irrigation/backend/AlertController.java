
package sn.irrigation.backend;

import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/v1/alerts")
public class AlertController {

    private final IrrigationAlertService alertService;

    public AlertController(IrrigationAlertService alertService) {
        this.alertService = alertService;
    }

    @GetMapping
    public Page<IrrigationAlert> getAlerts(
            @RequestParam(required = false) Boolean acknowledged,
            @RequestParam(required = false) String severity,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {

        try {
            return alertService.getAlerts(
                    acknowledged, severity, page, size);
        } catch (IllegalArgumentException exception) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    exception.getMessage());
        }
    }

    @PatchMapping("/{alertId}/acknowledgement")
    public IrrigationAlert acknowledgeAlert(
            @PathVariable Long alertId) {

        try {
            return alertService.acknowledgeAlert(alertId);
        } catch (AlertNotFoundException exception) {
            throw new ResponseStatusException(
                    HttpStatus.NOT_FOUND,
                    exception.getMessage());
        }
    }
}
