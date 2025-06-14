// Fixed version based on debug analysis
let isReady = false;

function initialize() {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      isReady = true;
    });
  } else {
    isReady = true;
  }
}

initialize();

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Content script received message:', message);
  
  if (!isReady) {
    sendResponse({ success: false, error: 'Page not ready yet' });
    return;
  }
  
  try {
    if (message.action === 'exportCurrentChat') {
      exportCurrentChat().then(result => {
        sendResponse(result);
      }).catch(error => {
        sendResponse({ success: false, error: error.message });
      });
      return true;
      
    } else if (message.action === 'exportAllChats') {
      exportAllChats().then(result => {
        sendResponse(result);
      }).catch(error => {
        sendResponse({ success: false, error: error.message });
      });
      return true;
    }
  } catch (error) {
    console.error('Content script error:', error);
    sendResponse({ success: false, error: error.message });
  }
});

async function exportCurrentChat() {
  try {
    chrome.runtime.sendMessage({ action: 'exportProgress', message: 'Analyzing chat structure...' });
    
    const chatData = await extractCurrentChatData();
    
    chrome.runtime.sendMessage({ action: 'exportProgress', message: 'Downloading file...' });
    
    await downloadAsJSON([chatData], 'gemini-current-chat');
    
    chrome.runtime.sendMessage({ action: 'exportComplete' });
    return { success: true };
    
  } catch (error) {
    console.error('Export current chat error:', error);
    chrome.runtime.sendMessage({ action: 'exportError', error: error.message });
    return { success: false, error: error.message };
  }
}

async function exportAllChats() {
  try {
    chrome.runtime.sendMessage({ action: 'exportProgress', message: 'Scanning chat history...' });
    
    const allChats = await extractAllChatsData();
    
    chrome.runtime.sendMessage({ action: 'exportProgress', message: 'Processing conversations...' });
    
    if (allChats.length === 0) {
      const currentChat = await extractCurrentChatData();
      await downloadAsJSON([currentChat], 'gemini-chats');
    } else {
      await downloadAsJSON(allChats, 'gemini-all-chats');
    }
    
    chrome.runtime.sendMessage({ action: 'exportComplete' });
    return { success: true };
    
  } catch (error) {
    console.error('Export all chats error:', error);
    chrome.runtime.sendMessage({ action: 'exportError', error: error.message });
    return { success: false, error: error.message };
  }
}

async function loadAllMessages() {
  console.log('🔄 Loading all messages by scrolling...');
  
  const scrollContainer = document.querySelector('c-wiz.bcGfM hfB8pd.r3W7p, [role="main"][data-scroll-container="true"], .scrollable-element, .chat-history-scroll-container, #chat-history, .chat-history, infinite-scroller, main');
  
  if (!scrollContainer) {
    console.log('⚠️ No robust scroll container found, proceeding with visible content');
    // Fallback to body if no specific scroll container is found
    // This might not load all messages but ensures basic functionality
    return;
  }
  
  let lastMessageCount = 0;
  let noChangeCount = 0;
  const maxNoChangeAttempts = 7; // Increase attempts for no change
  const maxScrollAttempts = 300; // Increase max scroll attempts for very long chats
  let scrollAttempts = 0;
  
  chrome.runtime.sendMessage({ action: 'exportProgress', message: 'Loading full conversation history...' });
  
  // Aggressively scroll to top to ensure all previous messages are loaded
  for (let i = 0; i < 5; i++) { // Repeat multiple times
    scrollContainer.scrollTop = 0;
    await new Promise(resolve => setTimeout(resolve, 500)); // Short delay between repetitions
  }
  await new Promise(resolve => setTimeout(resolve, 2000)); // Initial delay for content to appear

  while (scrollAttempts < maxScrollAttempts) {
    const allMessages = document.querySelectorAll('user-query, model-response, USER-QUERY, MODEL-RESPONSE');
    const currentMessageCount = allMessages.length;
    
    // Check if new content has loaded based on message count
    if (currentMessageCount > lastMessageCount) {
      noChangeCount = 0; // Reset counter if new content is found
    } else {
      noChangeCount++;
      if (noChangeCount >= maxNoChangeAttempts) {
        console.log('✅ No new messages loading after several attempts, conversation likely fully loaded');
        break; // Exit if no change after several attempts
      }
    }
    
    lastMessageCount = currentMessageCount;
    
    // Scroll up to load earlier messages
    scrollContainer.scrollTop = 0;
    await new Promise(resolve => setTimeout(resolve, 1500)); // Increased wait time
    
    // Scroll to bottom to ensure all loaded content is rendered and potentially load more
    scrollContainer.scrollTo({
      top: scrollContainer.scrollHeight,
      behavior: 'auto'
    });
    await new Promise(resolve => setTimeout(resolve, 1500)); // Increased wait time after scrolling down
    
    scrollAttempts++;
    
    chrome.runtime.sendMessage({ 
      action: 'exportProgress', 
      message: `Loading messages... Found ${allMessages.length} so far (attempt ${scrollAttempts})` 
    });
    console.log(`📊 Scroll attempt ${scrollAttempts}: Found ${allMessages.length} messages`);
  }
  
  console.log(`✅ Loading finished. Total attempts: ${scrollAttempts}, Final message count: ${document.querySelectorAll('user-query, model-response, USER-QUERY, MODEL-RESPONSE').length}`);
  
  // Scroll back to bottom to show latest messages
  scrollContainer.scrollTo({
    top: scrollContainer.scrollHeight,
    behavior: 'auto'
  });
  
  // Final wait for DOM to stabilize
  await new Promise(resolve => setTimeout(resolve, 1000));
}

async function extractCurrentChatData() {
  console.log('Extracting current chat data with full scroll loading...');

  // First, scroll to load all messages
  await loadAllMessages();

  const messages = [];

  // Query all loaded messages directly from the document
  const allChatElements = document.querySelectorAll('user-query, model-response, USER-QUERY, MODEL-RESPONSE');
  console.log('Found', allChatElements.length, 'total chat elements after full load');

  allChatElements.forEach((element, index) => {
    let role = '';
    let content = '';

    if (element.tagName.toLowerCase() === 'user-query') {
      role = 'user';
      // Try to get text directly from the element, then specific children
      content = element.textContent?.trim();
      if (!content) {
        const queryTextElements = element.querySelectorAll('.query-text-line, .query-text, p');
        let tempUserText = '';
        const seenTexts = new Set();
        queryTextElements.forEach(textElement => {
          const text = textElement.textContent?.trim();
          if (text && !text.includes('Opens in a new window') && !seenTexts.has(text)) {
            seenTexts.add(text);
            tempUserText += text + ' ';
          }
        });
        content = tempUserText.trim();
      }
      console.log(`Debug: User message element ${index}: Found content - ${!!content}`);

    } else if (element.tagName.toLowerCase() === 'model-response') {
      role = 'assistant';
      // Try to get text from markdown div, then directly from element, then other children
      const messageContent = element.querySelector('message-content, MESSAGE-CONTENT');
      const markdownDiv = messageContent?.querySelector('.markdown');

      if (markdownDiv) {
        let assistantText = '';
        const processedElements = new Set();
        const paragraphs = markdownDiv.querySelectorAll('p');
        paragraphs.forEach(p => {
          const text = p.textContent?.trim();
          if (text && text.length > 5 && !processedElements.has(text)) {
            processedElements.add(text);
            assistantText += text + '\n\n';
          }
        });
        const listItems = markdownDiv.querySelectorAll('li');
        if (listItems.length > 0) {
          assistantText += '\n';
          listItems.forEach(li => {
            const text = li.textContent?.trim();
            if (text && text.length > 5 && !processedElements.has(text)) {
              processedElements.add(text);
              assistantText += '• ' + text + '\n';
            }
          });
        }
        content = assistantText
          .replace(/\*\*(.*?)\*\*/g, '$1')
          .replace(/\n\n+/g, '\n\n')
          .replace(/Analysis\s*Analysis/gi, 'Analysis')
          .replace(/Read documents\s*/gi, '')
          .replace(/Response finalized\s*/gi, '')
          .trim();
      }

      if (!content) { // Fallback if markdown extraction failed
        content = element.textContent?.trim();
      }
      console.log(`Debug: Assistant message element ${index}: Found content - ${!!content}`);
    }

    if (content) {
      messages.push({
        role: role,
        content: content,
        element_id: element.id || `${role}-message-${messages.length}`,
        word_count: content.split(/\s+/).length
      });
      console.log(`Extracted ${role} message (total ${messages.length}):`, content.substring(0, 100) + '...');
    } else {
        console.log(`Warning: Failed to extract content for element ${index} with tag ${element.tagName.toLowerCase()}`);
    }
  });

  console.log('Total messages extracted:', messages.length);
  
  // Get page title
  let title = document.title || 'Gemini Chat';
  if (title.includes('Gemini')) {
    title = title.replace(/\s*[-–—]\s*Gemini.*$/, '').trim() || 'Gemini Chat';
  }

  const chatData = {
    id: 'current-chat-' + Date.now(),
    title: title,
    timestamp: new Date().toISOString(),
    url: window.location.href,
    messageCount: messages.length,
    messages: messages
  };
  
  console.log('Final extracted current chat data:', chatData);
  return chatData;
}

async function extractAllChatsData() {
  console.log('Extracting all chats data...');
  
  const allChats = [];

  // Gemini's sidebar chat history uses a different structure.
  // This part of the code might need significant updates if the sidebar HTML changes.
  const chatHistoryItems = document.querySelectorAll('.chat-history-item, .chat-list-item');
  console.log('Found', chatHistoryItems.length, 'sidebar chat history items');

  if (chatHistoryItems.length > 0) {
    for (const item of chatHistoryItems) {
      const titleElement = item.querySelector('.chat-title, .title');
      const urlElement = item.closest('a'); // Assuming the item is wrapped in an anchor tag
      const id = urlElement ? urlElement.href.split('/').pop() : `chat-${Math.random().toString(36).substr(2, 9)}`;
      const title = titleElement ? titleElement.textContent?.trim() : `Untitled Chat ${id}`;
      const url = urlElement ? urlElement.href : '';

      // For simplicity, we're just storing metadata for sidebar chats.
      // Extracting full content of *all* sidebar chats would require navigating to each chat,
      // which is beyond the scope of a simple content script export.
      allChats.push({
        id: id,
        title: title,
        url: url,
        // No messages here, as we don't navigate to load them.
        messageCount: 0 // Placeholder
      });
    }
  }

  // Always include current chat data, ensuring full messages are loaded
  const currentChatData = await extractCurrentChatData();
  if (currentChatData && currentChatData.messageCount > 0) {
    currentChatData.type = 'full_conversation'; // Add a type for clarity
    allChats.unshift(currentChatData); // Add to the beginning of the list
  }

  console.log('Total chat history items extracted:', allChats.length);
  return allChats;
}

async function downloadAsJSON(data, filename) {
  const now = new Date();
  const datePart = now.toISOString().slice(0, 10); // YYYY-MM-DD
  const timePart = now.toTimeString().slice(0, 5).replace(':', '-'); // HH-MM
  
  const exportData = {
    export_info: {
      timestamp: now.toISOString(),
      source: 'Gemini Chat Exporter v1.1.1', // Update version
      total_chats: data.length,
      total_messages: data.reduce((sum, chat) => sum + (chat.messageCount || 0), 0)
    },
    chats: data
  };

  const json = JSON.stringify(exportData, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}-${datePart}-${timePart}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

console.log('Gemini Chat Exporter v1.1.0 loaded - Auto-scroll for full conversation history');