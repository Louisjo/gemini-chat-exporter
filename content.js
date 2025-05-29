// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'exportAllChats') {
    exportAllChats();
  } else if (message.action === 'exportCurrentChat') {
    exportCurrentChat();
  }
});

function exportCurrentChat() {
  try {
    const chatData = extractCurrentChatData();
    downloadAsJSON([chatData], 'gemini-current-chat');
    chrome.runtime.sendMessage({ action: 'exportComplete' });
  } catch (error) {
    chrome.runtime.sendMessage({ action: 'exportError', error: error.message });
  }
}

function exportAllChats() {
  try {
    // First, try to get all chat conversations from the sidebar
    const allChats = extractAllChatsData();
    
    if (allChats.length === 0) {
      // Fallback to current chat if no sidebar chats found
      const currentChat = extractCurrentChatData();
      downloadAsJSON([currentChat], 'gemini-chats');
    } else {
      downloadAsJSON(allChats, 'gemini-all-chats');
    }
    
    chrome.runtime.sendMessage({ action: 'exportComplete' });
  } catch (error) {
    chrome.runtime.sendMessage({ action: 'exportError', error: error.message });
  }
}

function extractCurrentChatData() {
  const chatContainer = document.querySelector('[data-test-id="conversation-turn-list"]') || 
                       document.querySelector('.conversation-container') ||
                       document.querySelector('main');
  
  if (!chatContainer) {
    throw new Error('Could not find chat container');
  }

  const messages = [];
  
  // Try multiple selectors for messages
  const messageSelectors = [
    '[data-test-id="conversation-turn"]',
    '.conversation-turn',
    '[role="presentation"]',
    '.message-content'
  ];
  
  let messageElements = [];
  for (const selector of messageSelectors) {
    messageElements = chatContainer.querySelectorAll(selector);
    if (messageElements.length > 0) break;
  }
  
  // If no specific message elements found, try to extract from general structure
  if (messageElements.length === 0) {
    messageElements = chatContainer.querySelectorAll('div[data-message-author-role], div[class*="message"], div[class*="turn"]');
  }

  messageElements.forEach((element, index) => {
    const messageData = extractMessageData(element, index);
    if (messageData.content.trim()) {
      messages.push(messageData);
    }
  });

  return {
    id: 'current-chat-' + Date.now(),
    title: document.title || 'Gemini Chat',
    timestamp: new Date().toISOString(),
    url: window.location.href,
    messages: messages
  };
}

function extractAllChatsData() {
  const allChats = [];
  
  // Try to find chat history in sidebar
  const sidebarSelectors = [
    '[data-test-id="chat-history"]',
    '.chat-history',
    '[role="navigation"]',
    'nav'
  ];
  
  let sidebar = null;
  for (const selector of sidebarSelectors) {
    sidebar = document.querySelector(selector);
    if (sidebar) break;
  }
  
  if (sidebar) {
    const chatLinks = sidebar.querySelectorAll('a, button, [role="button"]');
    
    chatLinks.forEach((link, index) => {
      const title = link.textContent.trim();
      if (title && title.length > 0) {
        allChats.push({
          id: 'chat-' + index,
          title: title,
          timestamp: new Date().toISOString(),
          url: link.href || window.location.href,
          messages: [] // Note: Would need to navigate to each chat to get full content
        });
      }
    });
  }
  
  // Add current chat data
  try {
    const currentChat = extractCurrentChatData();
    allChats.unshift(currentChat);
  } catch (error) {
    console.warn('Could not extract current chat:', error);
  }
  
  return allChats;
}

function extractMessageData(element, index) {
  // Try to determine if it's user or assistant message
  const isUser = element.querySelector('[data-message-author-role="user"]') ||
                element.textContent.includes('You:') ||
                element.classList.contains('user-message');
  
  const isAssistant = element.querySelector('[data-message-author-role="model"]') ||
                     element.textContent.includes('Gemini:') ||
                     element.classList.contains('assistant-message');
  
  let role = 'unknown';
  if (isUser) role = 'user';
  else if (isAssistant) role = 'assistant';
  else role = index % 2 === 0 ? 'user' : 'assistant'; // Fallback alternating pattern
  
  // Extract text content, preserving formatting
  let content = '';
  const textElement = element.querySelector('[data-message-content]') || element;
  
  // Try to preserve code blocks and formatting
  const codeBlocks = textElement.querySelectorAll('pre, code');
  codeBlocks.forEach(block => {
    block.textContent = '\n```\n' + block.textContent + '\n```\n';
  });
  
  content = textElement.innerText || textElement.textContent || '';
  
  return {
    role: role,
    content: content.trim(),
    timestamp: new Date().toISOString(),
    element_id: element.id || `message-${index}`
  };
}

function downloadAsJSON(data, filename) {
  const jsonString = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Alternative export formats
function downloadAsText(data, filename) {
  let textContent = '';
  
  data.forEach(chat => {
    textContent += `Chat: ${chat.title}\n`;
    textContent += `Date: ${chat.timestamp}\n`;
    textContent += `URL: ${chat.url}\n`;
    textContent += '='.repeat(50) + '\n\n';
    
    chat.messages.forEach(message => {
      textContent += `${message.role.toUpperCase()}:\n${message.content}\n\n`;
    });
    
    textContent += '\n' + '='.repeat(80) + '\n\n';
  });
  
  const blob = new Blob([textContent], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}-${new Date().toISOString().split('T')[0]}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}