
package sn.irrigation.backend;

import jakarta.persistence.*;

@Entity
@Table(name = "irrigation_settings")
public class IrrigationSettings {

    @Id
    private Long id = 1L;

    @Column(nullable = false)
    private Double moistureThreshold = 30.0;

    @Column(nullable = false)
    private Boolean automaticModeEnabled = false;

    public IrrigationSettings() {
    }

    public Long getId() {
        return id;
    }

    public Double getMoistureThreshold() {
        return moistureThreshold;
    }

    public void setMoistureThreshold(Double moistureThreshold) {
        this.moistureThreshold = moistureThreshold;
    }

    public Boolean getAutomaticModeEnabled() {
        return automaticModeEnabled;
    }

    public void setAutomaticModeEnabled(Boolean automaticModeEnabled) {
        this.automaticModeEnabled = automaticModeEnabled;
    }
}
