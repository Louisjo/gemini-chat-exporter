document.addEventListener('DOMContentLoaded', function() {
  const exportBtn = document.getElementById('exportBtn');
  const exportCurrentBtn = document.getElementById('exportCurrentBtn');
  const status = document.getElementById('status');

  exportBtn.addEventListener('click', async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab.url.includes('gemini.google.com')) {
        showStatus('Please navigate to Gemini website first', 'error');
        return;
      }

      showStatus('Exporting chats...', '');
      
      await chrome.tabs.sendMessage(tab.id, { action: 'exportAllChats' });
      
    } catch (error) {
      showStatus('Error: ' + error.message, 'error');
    }
  });

  exportCurrentBtn.addEventListener('click', async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab.url.includes('gemini.google.com')) {
        showStatus('Please navigate to Gemini website first', 'error');
        return;
      }

      showStatus('Exporting current chat...', '');
      
      await chrome.tabs.sendMessage(tab.id, { action: 'exportCurrentChat' });
      
    } catch (error) {
      showStatus('Error: ' + error.message, 'error');
    }
  });

  function showStatus(message, type) {
    status.textContent = message;
    status.className = type;
  }

  // Listen for messages from content script
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'exportComplete') {
      showStatus('Export completed successfully!', 'success');
    } else if (message.action === 'exportError') {
      showStatus('Export failed: ' + message.error, 'error');
    }
  });
});