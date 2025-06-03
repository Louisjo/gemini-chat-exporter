document.addEventListener('DOMContentLoaded', function () {
  const exportBtn = document.getElementById('exportBtn');
  const exportCurrentBtn = document.getElementById('exportCurrentBtn');
  const status = document.getElementById('status');

  // Define showStatus function early since it's now a const
  const showStatus = (message, type) => {
    status.textContent = message;
    status.className = type;

    // Auto-clear success messages after 5 seconds (increased from 3)
    if (type === 'success') {
      setTimeout(() => {
        status.textContent = '';
        status.className = '';
      }, 5000);
    }
  };

  exportBtn.addEventListener('click', async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      if (!tab.url.includes('gemini.google.com')) {
        showStatus('Please navigate to Gemini website first', 'error');
        return;
      }

      showStatus('Starting export...', '');

      // Don't wait for response - let the content script handle completion notification
      chrome.tabs.sendMessage(tab.id, { action: 'exportAllChats' }).catch(error => {
        console.log('Message send error (this might be normal):', error);
        // Don't show error immediately - wait for progress messages
      });

    } catch (error) {
      console.error('Export error:', error);
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

      showStatus('Starting current chat export...', '');

      // Don't wait for response - let the content script handle completion notification
      chrome.tabs.sendMessage(tab.id, { action: 'exportCurrentChat' }).catch(error => {
        console.log('Message send error (this might be normal):', error);
        // Don't show error immediately - wait for progress messages
      });

    } catch (error) {
      console.error('Export current error:', error);
      showStatus('Error: ' + error.message, 'error');
    }
  });

  // Add debug button functionality
  const debugBtn = document.getElementById('debugBtn');
  if (debugBtn) {
    debugBtn.addEventListener('click', async () => {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        // For debug, we do want to wait for response since it's synchronous
        const response = await chrome.tabs.sendMessage(tab.id, { action: 'debug' });
        if (response?.success) {
          showStatus('Debug info logged to console (F12)', 'success');
        } else {
          showStatus('Debug failed', 'error');
        }
      } catch (error) {
        showStatus('Debug failed: ' + error.message, 'error');
      }
    });
  }

  // Listen for messages from content script - NOW HANDLES PROGRESS
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Popup received message:', message);

    switch (message.action) {
      case 'exportProgress':
        showStatus(message.message, '');
        break;
      case 'exportComplete':
        showStatus('Export completed successfully! Check your downloads.', 'success');
        break;
      case 'exportError':
        showStatus('Export failed: ' + message.error, 'error');
        break;
      default:
        console.log('Unknown message action:', message.action);
    }
  });
});