// --- BLE Service and Characteristic UUIDs (MUST match web_interface.h) ---
const SERVICE_UUID = "4FAFC201-1FB5-4740-984A-953835CE2260";
const CONFIG_CHAR_UUID = "BEB5483E-36E1-4688-B7F5-EA07361B26A8";
const COMMAND_CHAR_UUID = "BEB5483E-36E1-4688-B7F5-EA07361B26A9";

// Global BLE objects
let gattServer;
let configCharacteristic;
let commandCharacteristic;

// DOM Elements
const statusDiv = document.getElementById('status');
const connectButton = document.getElementById('connectButton');
const configForm = document.getElementById('configForm');
const saveButton = document.getElementById('saveButton');
const closeButton = document.getElementById('closeButton');

// Utility functions for UI updates
const setStatus = (message, color = 'black') => {
    statusDiv.textContent = `Status: ${message}`;
    statusDiv.style.color = color;
};

// --- CORE BLE FUNCTIONS ---

/**
 * 1. Connects to the ESP32 BLE device.
 */
async function connectBle() {
    try {
        setStatus('Scanning for LoRa Node...');
        
        // Request the device using the service UUID
        const device = await navigator.bluetooth.requestDevice({
            filters: [{ services: [SERVICE_UUID] }]
        });
        
        setStatus(`Connecting to ${device.name}...`);
        
        // Connect to GATT server
        gattServer = await device.gatt.connect();
        
        // Get the service and characteristics
        const service = await gattServer.getPrimaryService(SERVICE_UUID);
        configCharacteristic = await service.getCharacteristic(CONFIG_CHAR_UUID);
        commandCharacteristic = await service.getCharacteristic(COMMAND_CHAR_UUID);
        
        setStatus('Connected successfully!', 'green');
        connectButton.classList.add('hidden');
        configForm.classList.remove('hidden');

        // Load current config immediately after connection
        await readConfig();

    } catch (error) {
        setStatus(`Connection Failed: ${error.message}`, 'red');
        console.error('BLE Error:', error);
    }
}

/**
 * 2. Reads the configuration JSON from the ESP32.
 */
async function readConfig() {
    try {
        setStatus('Reading configuration...');
        const value = await configCharacteristic.readValue();
        const configJson = new TextDecoder().decode(value);
        const config = JSON.parse(configJson);
        
        // Populate form fields
        document.getElementById('nodeId').value = config.nodeId;
        document.getElementById('networkId').value = config.networkId;
        document.getElementById('interval').value = config.interval; // already in seconds
        document.getElementById('defaultDest').value = config.defaultDest;
        
        setStatus('Configuration loaded.', 'green');

    } catch (error) {
        setStatus(`Failed to read config: ${error.message}`, 'red');
        console.error('Read Error:', error);
    }
}

/**
 * 3. Saves the configuration JSON to the ESP32.
 */
async function saveConfig() {
    try {
        setStatus('Saving configuration...');
        
        // Read values from form
        const newConfig = {
            nodeId: parseInt(document.getElementById('nodeId').value),
            networkId: document.getElementById('networkId').value,
            interval: parseInt(document.getElementById('interval').value),
            defaultDest: parseInt(document.getElementById('defaultDest').value)
        };
        
        // Prepare data for BLE write
        const configJson = JSON.stringify(newConfig);
        const data = new TextEncoder().encode(configJson);
        
        await configCharacteristic.writeValue(data);
        
        setStatus('Configuration saved!', 'green');

    } catch (error) {
        setStatus(`Failed to save config: ${error.message}`, 'red');
        console.error('Save Error:', error);
    }
}

/**
 * 4. Sends the CLOSE_AP command to stop the BLE service.
 */
async function closeBleService() {
    try {
        setStatus('Sending CLOSE_AP command...');
        const command = new TextEncoder().encode("CLOSE_AP");
        await commandCharacteristic.writeValue(command);
        
        setStatus('BLE service stopped on node. Disconnecting...', 'orange');
        
        // Disconnect from the PWA side
        if (gattServer && gattServer.connected) {
            gattServer.disconnect();
        }
        
        // Reset UI
        configForm.classList.add('hidden');
        connectButton.classList.remove('hidden');
        setStatus('Disconnected.', 'black');

    } catch (error) {
        setStatus(`Failed to send command: ${error.message}`, 'red');
        console.error('Command Error:', error);
    }
}

// --- Event Listeners ---
connectButton.addEventListener('click', connectBle);
saveButton.addEventListener('click', saveConfig);
closeButton.addEventListener('click', closeBleService);

// Check for Web Bluetooth support on load
if (!('bluetooth' in navigator)) {
    setStatus('Web Bluetooth not supported in this browser.', 'red');
    connectButton.disabled = true;
}
