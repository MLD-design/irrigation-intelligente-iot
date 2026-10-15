
package sn.irrigation.backend;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class DeviceKeyValidator {

    @Value("${irrigation.device-key}")
    private String expectedKey;

    public boolean isValid(String providedKey) {
        return expectedKey != null
                && !expectedKey.isBlank()
                && expectedKey.equals(providedKey);
    }
}
