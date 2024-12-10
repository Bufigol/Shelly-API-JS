document.addEventListener('DOMContentLoaded', () => {
    const deviceStatusDiv = document.getElementById('status-text');
    const deviceConfigForm = document.getElementById('device-config-form');

    // Fetch the latest device status
    async function fetchDeviceStatus() {
        try {
            const response = await fetch('/api/devices/latest-status');
            if (!response.ok) throw new Error('Error fetching device status');
            const data = await response.json();
            deviceStatusDiv.innerText = JSON.stringify(data, null, 2);
        } catch (error) {
            deviceStatusDiv.innerText = 'Error: ' + error.message;
        }
    }

    // Handle form submission for updating configuration
    deviceConfigForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const deviceId = document.getElementById('deviceId').value;
        const config = document.getElementById('config').value;

        try {
            const response = await fetch(`/api/devices/config/${deviceId}`, {
                method: 'PUT',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ config })
            });
            if (!response.ok) throw new Error('Error updating device configuration');
            alert('Configuración actualizada con éxito');
            fetchDeviceStatus(); // Refresh status after update
        } catch (error) {
            alert('Error: ' + error.message);
        }
    });

    fetchDeviceStatus(); // Initial fetch
});
