document.addEventListener('DOMContentLoaded', () => {
  const lightningList = document.getElementById('lightning-list');

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

  // Fetch data initially and then every 10 seconds
  fetchData();
  setInterval(fetchData, 10000);
});
