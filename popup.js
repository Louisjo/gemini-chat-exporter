document.addEventListener('DOMContentLoaded', function() {
  const exportCurrentBtn = document.getElementById('exportCurrentBtn');
  const exportAllChatsBtn = document.getElementById('exportAllBtn');
  const status = document.getElementById('status');

  exportAllChatsBtn.addEventListener('click', async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab.url.includes('gemini.google.com')) {
        showStatus('Please navigate to Gemini website first', 'error');
        return;
      }

      showStatus('Exporting chats...', 'loading');
      
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

      showStatus('Exporting current chat...', 'loading');
      
      await chrome.tabs.sendMessage(tab.id, { action: 'exportCurrentChat' });
      
    } catch (error) {
      showStatus('Error: ' + error.message, 'error');
    }
  });

  function showStatus(message, type, count = null) {
    status.className = type;
    let displayMessage = message;

    if (type === 'loading') {
      displayMessage = `<div class="spinner"></div> ${message}`;
      if (count !== null) {
        displayMessage += ` (Found ${count} messages)`;
      }
    } else if (type === 'success') {
        displayMessage = `✅ ${message}`;
    } else if (type === 'error') {
        displayMessage = `❌ ${message}`;
    }

    status.innerHTML = displayMessage;
  }

  // Listen for messages from content script
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'exportComplete') {
      showStatus('Export completed successfully!', 'success');
    } else if (message.action === 'exportError') {
      showStatus('Export failed: ' + message.error, 'error');
    } else if (message.action === 'exportProgress') {
      showStatus(message.message, 'loading', message.count);
    }
  });
});