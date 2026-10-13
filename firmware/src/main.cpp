#include <Arduino.h>

void setup() {
  // Initialisation de la communication série à 115200 bauds
  Serial.begin(115200);
  delay(1000);
  Serial.println("Système d'irrigation intelligente - ESP32 initialisé !");
}

void loop() {
  Serial.println("ESP32 en cours de fonctionnement...");
  delay(5000);
}