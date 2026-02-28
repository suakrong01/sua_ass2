#include <WiFi.h>
#include <PubSubClient.h>

// --- Configuration ---
// WiFi Settings
const char* ssid = "IOT";
const char* password = "mfuiot2023";

// MQTT Broker Settings (Matching script.js)
const char* mqtt_server = "broker.emqx.io";
const int mqtt_port = 1883; // Standard MQTT port (script.js uses WebSocket 8084)
const char* mqtt_client_id = "ESP32_GravityMeter_Client123"; // Make this unique
const char* topic_moisture = "gravity_meter/moisture";
const char* topic_pump = "gravity_meter/pump";

// Hardware Pins
const int MOISTURE_SENSOR_PIN = 34; // Analog pin for soil moisture sensor
const int PUMP_PIN = 2; // Digital pin for Pump relay or LED (Pin 2 is onboard LED)

// Variables
WiFiClient espClient;
PubSubClient client(espClient);
unsigned long lastMsg = 0;
const int PUBLISH_INTERVAL = 5000; // Publish moisture every 5 seconds

// Sensor Calibration (Adjust these based on your specific sensor)
// Many analog sensors read high when dry, low when wet.
const int SENSOR_DRY_VALUE = 4095; // ESP32 ADC max is usually 4095
const int SENSOR_WET_VALUE = 1000; 

void setup() {
  Serial.begin(115200);
  
  pinMode(PUMP_PIN, OUTPUT);
  digitalWrite(PUMP_PIN, LOW); // Pump off initially
  
  setup_wifi();
  
  client.setServer(mqtt_server, mqtt_port);
  client.setCallback(callback);
}

void setup_wifi() {
  delay(10);
  Serial.println();
  Serial.print("Connecting to ");
  Serial.println(ssid);

  WiFi.begin(ssid, password);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println("");
  Serial.println("WiFi connected");
  Serial.println("IP address: ");
  Serial.println(WiFi.localIP());
}

void callback(char* topic, byte* message, unsigned int length) {
  Serial.print("Message arrived on topic: ");
  Serial.print(topic);
  Serial.print(". Message: ");
  String messageTemp;
  
  for (int i = 0; i < length; i++) {
    Serial.print((char)message[i]);
    messageTemp += (char)message[i];
  }
  Serial.println();

  // If a message is received on the pump topic
  if (String(topic) == topic_pump) {
    Serial.print("Changing output to ");
    if(messageTemp == "ON"){
      Serial.println("ON");
      digitalWrite(PUMP_PIN, HIGH);
      // Optional: Turn pump off automatically after a few seconds
      delay(3000); 
      digitalWrite(PUMP_PIN, LOW);
      Serial.println("Pump turned automatically OFF");
    }
  }
}

void reconnect() {
  // Loop until we're reconnected
  while (!client.connected()) {
    Serial.print("Attempting MQTT connection...");
    // Attempt to connect
    if (client.connect(mqtt_client_id)) {
      Serial.println("connected");
      // Resubscribe to pump topic
      client.subscribe(topic_pump);
    } else {
      Serial.print("failed, rc=");
      Serial.print(client.state());
      Serial.println(" try again in 5 seconds");
      // Wait 5 seconds before retrying
      delay(5000);
    }
  }
}

void loop() {
  if (!client.connected()) {
    reconnect();
  }
  client.loop();

  unsigned long now = millis();
  if (now - lastMsg > PUBLISH_INTERVAL) {
    lastMsg = now;
    
    // Read analog sensor
    int sensorValue = analogRead(MOISTURE_SENSOR_PIN);
    
    // Convert to percentage (0-100%)
    // Map function maps (value, fromLow, fromHigh, toLow, toHigh)
    int moisturePercent = map(sensorValue, SENSOR_DRY_VALUE, SENSOR_WET_VALUE, 0, 100);
    
    // Clamp values between 0 and 100
    if (moisturePercent > 100) moisturePercent = 100;
    if (moisturePercent < 0) moisturePercent = 0;

    Serial.print("Sensor Value: ");
    Serial.print(sensorValue);
    Serial.print(" -> Moisture Percent: ");
    Serial.print(moisturePercent);
    Serial.println("%");

    // Convert integer to string for MQTT payload
    char moistureString[8];
    itoa(moisturePercent, moistureString, 10);
    
    // Publish message
    client.publish(topic_moisture, moistureString);
  }
}
