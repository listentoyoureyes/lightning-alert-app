document.addEventListener('DOMContentLoaded', () => {
  const lightningList = document.getElementById('lightning-list');
  const logContainer = document.getElementById('log-container');

  const fetchData = () => {
    fetch('/api/lightning-data')
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
      })
      .then(data => {
        lightningList.innerHTML = ''; // Clear the current list
        // Sort data in descending order by number
        data.sort((a, b) => b.number - a.number);
        data.forEach(item => {
          const listItem = document.createElement('li');
          listItem.textContent = `#${item.number} - ${item.cities.join(', ')} - ${new Date(item.timestamp).toLocaleString()} - ${item.peakCurrent} kA`;
          lightningList.appendChild(listItem);
        });
      })
      .catch(error => {
        console.error('Error fetching lightning data:', error);
      });
  };

  const fetchLogs = () => {
    fetch('/api/logs')
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.text();
      })
      .then(data => {
        logContainer.textContent = data; // Display logs
      })
      .catch(error => {
        console.error('Error fetching logs:', error);
      });
  };

  // Fetch data initially and then every 10 seconds
  fetchData();
  setInterval(fetchData, 10000);

  // Fetch logs initially and then every 10 seconds
  fetchLogs();
  setInterval(fetchLogs, 10000);
});
