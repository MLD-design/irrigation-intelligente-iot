#include <Arduino.h>
#include <WiFi.h>

const char* ssid     = "CRD-UADB";          // Ton Wi-Fi
const char* password = "2023CRDUADB";

void setup() {
  Serial.begin(115200);
  delay(1000);

  // Indique que l'ESP32 est en marche
  Serial.println("\n[ESP32] Système démarré et opérationnel.");

  // Connexion au réseau Wi-Fi
  Serial.printf("[WiFi] Connexion en cours au réseau : %s\n", ssid);
  WiFi.begin(ssid, password);

  // Attente de la connexion
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  // Confirmation de la connexion et affichage de l'état
  Serial.println("\n[WiFi] Connexion établie avec succès !");
  Serial.print("[WiFi] Adresse IP de l'ESP32 : ");
  Serial.println(WiFi.localIP());
}

void loop() {
  // Vérification périodique de l'état de la connexion Wi-Fi
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[WiFi] Connexion perdue. Tentative de reconnexion...");
    WiFi.reconnect();
  }
  
  delay(10000); // Vérification toutes les 10 secondes
}