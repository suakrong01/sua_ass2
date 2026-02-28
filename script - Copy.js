// Configuration
const CHAMBER_HEIGHT_OFFSET = 60; // Offset to keep icon within bounds
const CONTAINER_HEIGHT = 400;     // Matches CSS --chamber-height

// MQTT Broker Settings
// Using EMQX's public WebSocket broker for demo. Change as needed.
const MQTT_BROKER_URL = 'wss://broker.emqx.io:8084/mqtt';
const MQTT_TOPIC_MOISTURE = 'gravity_meter/moisture';
const MQTT_TOPIC_PUMP = 'gravity_meter/pump';

// State
let moistureLevel = 100; // 0 to 100%
let isSimulated = true;
let intervalId = null;

// DOM Elements
const gravityIcon = document.getElementById('gravity-icon');
const moistureText = document.getElementById('moisture-text');
const waterBtn = document.getElementById('water-btn');
const connectionStatus = document.getElementById('connection-status');
const connectionStatusText = connectionStatus.querySelector('.status-text');

// --- MQTT Setup ---
console.log("Connecting to MQTT broker...");
const client = mqtt.connect(MQTT_BROKER_URL);

function updateConnectionStatus(isConnected) {
    if (isConnected) {
        connectionStatus.classList.remove('disconnected');
        connectionStatus.classList.add('connected');
        connectionStatusText.textContent = 'ESP32 Online';
    } else {
        connectionStatus.classList.remove('connected');
        connectionStatus.classList.add('disconnected');
        connectionStatusText.textContent = 'ESP32 Offline';
    }
}

client.on('connect', () => {
    console.log("✅ Connected to MQTT broker:", MQTT_BROKER_URL);
    updateConnectionStatus(true);

    client.subscribe(MQTT_TOPIC_MOISTURE, (err) => {
        if (!err) {
            console.log(`📡 Subscribed to topic: ${MQTT_TOPIC_MOISTURE}`);
        } else {
            console.error("❌ Subscribe error:", err);
        }
    });
});

client.on('offline', () => {
    updateConnectionStatus(false);
});

client.on('close', () => {
    updateConnectionStatus(false);
});

client.on('error', (err) => {
    console.error("Broker connection error:", err);
    updateConnectionStatus(false);
});

client.on('message', (topic, message) => {
    if (topic === MQTT_TOPIC_MOISTURE) {
        // We received actual data! Stop the simulation.
        if (isSimulated) {
            console.log("🛑 Real data received. Stopping simulation.");
            clearInterval(intervalId);
            isSimulated = false;
        }

        const rawValue = message.toString();
        const parsedValue = parseInt(rawValue, 10);

        if (!isNaN(parsedValue)) {
            moistureLevel = parsedValue;
            updateUI();
        } else {
            console.warn(`⚠️ Invalid moisture payload received: ${rawValue}`);
        }
    }
});

// --- UI Logic ---
function updateUI() {
    // Clamp moisture between 0 and 100
    if (moistureLevel < 0) moistureLevel = 0;
    if (moistureLevel > 100) moistureLevel = 100;

    // Update Text
    moistureText.innerText = `${moistureLevel}%`;

    // Update Gravity Icon Position
    const maxDrop = CONTAINER_HEIGHT - CHAMBER_HEIGHT_OFFSET;
    const currentTop = maxDrop - ((moistureLevel / 100) * maxDrop);

    gravityIcon.style.top = `${currentTop}px`;

    // Visual feedback for low moisture
    if (moistureLevel < 30) {
        gravityIcon.classList.add('falling');
        gravityIcon.innerHTML = '🍂';
        moistureText.style.color = 'var(--danger-color)';
    } else {
        gravityIcon.classList.remove('falling');
        gravityIcon.innerHTML = '💧';
        moistureText.style.color = 'var(--primary-color)';
    }
}

// Fallback: Local drying simulation in case MQTT isn't sending data yet
function simulateDrying() {
    if (!isSimulated) return;

    moistureLevel -= 2; // drying amount
    if (moistureLevel <= 0) moistureLevel = 0;

    updateUI();
}

// --- Action ---
function restoreGravity() {
    console.log("🌊 Sending Pump Command...");

    if (client.connected) {
        // Publish pump command to MQTT
        client.publish(MQTT_TOPIC_PUMP, 'ON', (error) => {
            if (error) {
                console.error("❌ Failed to publish pump command:", error);
            } else {
                console.log(`✅ Pump Activated Command sent to ${MQTT_TOPIC_PUMP}`);

                // If we're still running the simulation, force UI to 100% just for demo
                if (isSimulated) {
                    moistureLevel = 100;
                    updateUI();
                }
            }
        });
    } else {
        console.warn("⚠️ Cannot send pump command - MQTT disconnected");
        // Fallback for demo
        if (isSimulated) {
            moistureLevel = 100;
            updateUI();
        }
    }
}

// Event Listeners
waterBtn.addEventListener('click', restoreGravity);

// Start initial simulation (will stop when first real MQTT message arrives)
intervalId = setInterval(simulateDrying, 1000);

// Initial Render
updateUI();
