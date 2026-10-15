
package sn.irrigation.backend;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Map;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1")
public class HealthController {

    @GetMapping("/health")
    //class
    public Map<String, Object> getHealth() {
        return Map.of(
            "status", "UP",
            "timestamp", OffsetDateTime.now(ZoneOffset.UTC)
        );
    }
}
