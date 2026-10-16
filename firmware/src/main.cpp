
#include <Arduino.h>
#include <WiFi.h>
#include <WiFiClient.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <time.h>

#include "secrets.h"

// ==================== CONFIGURATION ====================

const char* API_BASE_URL = "http://192.168.1.41:8081/api/v1";
const char* DEVICE_KEY = IRRIGATION_DEVICE_KEY;
const char* DEVICE_ID = "ESP32-001";

const int PIN_CAPTEUR = 34;
const int VALEUR_SECHE = 0;
const int VALEUR_HUMIDE = 2000;

// Sécurité : simulation uniquement, aucune commande physique.
const bool MODE_SIMULATION = true;

// Intervalles
const unsigned long INTERVALLE_MESURE = 10000;
const unsigned long INTERVALLE_COMMANDE = 5000;

unsigned long dernierEnvoiMesure = 0;
unsigned long derniereVerificationCommande = 0;

// ==================== HORODATAGE ====================

String obtenirHorodatage() {
    struct tm timeinfo;

    if (!getLocalTime(&timeinfo, 1000)) {
        return "";
    }

    char buffer[30];

    strftime(
        buffer,
        sizeof(buffer),
        "%Y-%m-%dT%H:%M:%SZ",
        &timeinfo
    );

    return String(buffer);
}

// ==================== MESURE D'HUMIDITÉ ====================

float lireHumiditeSol() {
    long somme = 0;
    const int NOMBRE_LECTURES = 10;

    for (int i = 0; i < NOMBRE_LECTURES; i++) {
        somme += analogRead(PIN_CAPTEUR);
        delay(10);
    }

    int valeurBrute = somme / NOMBRE_LECTURES;

    float humidite =
        (float)(valeurBrute - VALEUR_SECHE) * 100.0
        / (VALEUR_HUMIDE - VALEUR_SECHE);

    humidite = constrain(humidite, 0.0f, 100.0f);

    Serial.print("Valeur brute du capteur : ");
    Serial.println(valeurBrute);

    Serial.print("Humidite calculee : ");
    Serial.print(humidite);
    Serial.println(" %");

    return humidite;
}

// ==================== ENVOI D'UNE MESURE ====================

void envoyerMesure() {
    if (WiFi.status() != WL_CONNECTED) {
        Serial.println("Wi-Fi indisponible : mesure non envoyee.");
        return;
    }

    float humidite = lireHumiditeSol();

    JsonDocument doc;
    doc["deviceId"] = DEVICE_ID;
    doc["soilMoisture"] = humidite;

    String horodatage = obtenirHorodatage();

    if (horodatage.length() > 0) {
        doc["measuredAt"] = horodatage;
    }

    String payload;
    serializeJson(doc, payload);

    WiFiClient client;
    HTTPClient http;

    String url = String(API_BASE_URL) + "/measurements";

    http.setTimeout(5000);

    if (!http.begin(client, url)) {
        Serial.println("Initialisation HTTP des mesures impossible.");
        return;
    }

    http.addHeader("Content-Type", "application/json");
    http.addHeader("X-Device-Key", DEVICE_KEY);

    Serial.println("Envoi de la mesure au backend...");
    Serial.println(payload);

    int codeHTTP = http.POST(payload);

    Serial.print("Code HTTP mesure : ");
    Serial.println(codeHTTP);

    if (codeHTTP > 0) {
        Serial.println(http.getString());
    } else {
        Serial.println(http.errorToString(codeHTTP));
    }

    http.end();
}

// ==================== RETOUR DE SIMULATION ====================

void envoyerResultatSimulation(
    const String& commandId,
    const char* status,
    const char* message
) {
    if (WiFi.status() != WL_CONNECTED) {
        Serial.println("Wi-Fi indisponible : resultat non envoye.");
        return;
    }

    WiFiClient client;
    HTTPClient http;

    String url = String(API_BASE_URL)
        + "/device/commands/"
        + commandId
        + "/result";

    http.setTimeout(5000);

    if (!http.begin(client, url)) {
        Serial.println("Initialisation HTTP du resultat impossible.");
        return;
    }

    http.addHeader("Content-Type", "application/json");
    http.addHeader("X-Device-Key", DEVICE_KEY);

    JsonDocument doc;
    doc["status"] = status;
    doc["message"] = message;
    doc["simulated"] = true;

    String payload;
    serializeJson(doc, payload);

    Serial.println("Envoi du resultat simule au backend...");
    Serial.println(payload);

    int codeHTTP = http.POST(payload);

    Serial.print("Code HTTP du resultat : ");
    Serial.println(codeHTTP);

    if (codeHTTP >= 200 && codeHTTP < 300) {
        Serial.println("Resultat simule transmis avec succes.");
    } else {
        Serial.println("Echec de l'envoi du resultat simule.");

        if (codeHTTP > 0) {
            Serial.println(http.getString());
        } else {
            Serial.println(http.errorToString(codeHTTP));
        }
    }

    http.end();
}

// ==================== RÉCUPÉRATION DES COMMANDES ====================

void recupererCommande() {
    if (WiFi.status() != WL_CONNECTED) {
        Serial.println("Wi-Fi indisponible : commandes non recuperees.");
        return;
    }

    WiFiClient client;
    HTTPClient http;

    String url = String(API_BASE_URL) + "/device/commands/next";

    http.setTimeout(5000);

    if (!http.begin(client, url)) {
        Serial.println("Initialisation HTTP des commandes impossible.");
        return;
    }

    http.addHeader("X-Device-Key", DEVICE_KEY);

    int codeHTTP = http.GET();

    if (codeHTTP == 204) {
        Serial.println("Aucune commande en attente.");
        http.end();
        return;
    }

    if (codeHTTP != 200) {
        Serial.print("Erreur de recuperation des commandes : ");
        Serial.println(codeHTTP);

        if (codeHTTP > 0) {
            Serial.println(http.getString());
        } else {
            Serial.println(http.errorToString(codeHTTP));
        }

        http.end();
        return;
    }

    String reponse = http.getString();
    http.end();

    JsonDocument doc;
    DeserializationError erreur = deserializeJson(doc, reponse);

    if (erreur) {
        Serial.print("Erreur JSON : ");
        Serial.println(erreur.c_str());
        return;
    }

    String commandId = doc["commandId"] | "";
    String action = doc["action"] | "";

    if (commandId.length() == 0) {
        Serial.println("Commande ignoree : identifiant absent.");
        return;
    }

    Serial.println("Commande recue.");
    Serial.print("Identifiant : ");
    Serial.println(commandId);

    Serial.print("Action demandee : ");
    Serial.println(action);

    // Aucune action physique n'est executee.
    if (!MODE_SIMULATION) {
        Serial.println("Mode simulation desactive : commande non executee.");
        envoyerResultatSimulation(
            commandId,
            "REJECTED",
            "Commande non executee : mode simulation requis."
        );
        return;
    }

    if (action == "START") {
        Serial.println("[SIMULATION] Demarrage logique de la pompe.");
    } else if (action == "STOP") {
        Serial.println("[SIMULATION] Arret logique de la pompe.");
    } else {
        Serial.println("[SIMULATION] Action inconnue.");

        envoyerResultatSimulation(
            commandId,
            "REJECTED",
            "Action inconnue : aucune action physique executee."
        );

        return;
    }

    envoyerResultatSimulation(
        commandId,
        "EXECUTED",
        "Simulation logique uniquement : aucune action physique sur la pompe."
    );
}

// ==================== INITIALISATION ====================

void setup() {
    Serial.begin(115200);
    delay(1000);

    pinMode(PIN_CAPTEUR, INPUT);
    analogReadResolution(12);

    Serial.println();
    Serial.println("==================================");
    Serial.println(" IRRIGATION INTELLIGENTE - ESP32");
    Serial.println(" MODE SIMULATION UNIQUEMENT");
    Serial.println("==================================");

    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

    Serial.print("Connexion au Wi-Fi");

    unsigned long debutConnexion = millis();

    while (
        WiFi.status() != WL_CONNECTED
        && millis() - debutConnexion < 20000
    ) {
        delay(500);
        Serial.print(".");
    }

    Serial.println();

    if (WiFi.status() == WL_CONNECTED) {
        Serial.println("Wi-Fi connecte.");

        Serial.print("Adresse IP ESP32 : ");
        Serial.println(WiFi.localIP());

        // Synchronisation de l'horloge pour les mesures.
        configTime(0, 0, "pool.ntp.org", "time.google.com");

        Serial.println("Synchronisation de l'horloge demandee.");
    } else {
        Serial.println("Connexion Wi-Fi impossible pour le moment.");
    }
}

// ==================== BOUCLE PRINCIPALE ====================

void loop() {
    if (WiFi.status() != WL_CONNECTED) {
        delay(1000);
        return;
    }

    unsigned long maintenant = millis();

    if (
        maintenant - dernierEnvoiMesure
        >= INTERVALLE_MESURE
    ) {
        dernierEnvoiMesure = maintenant;
        envoyerMesure();
    }

    if (
        maintenant - derniereVerificationCommande
        >= INTERVALLE_COMMANDE
    ) {
        derniereVerificationCommande = maintenant;
        recupererCommande();
    }

    delay(50);
}
