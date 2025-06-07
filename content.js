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
  
  const scrollContainer = document.querySelector('.chat-history-scroll-container') ||
                         document.querySelector('#chat-history') ||
                         document.querySelector('.chat-history') ||
                         document.querySelector('infinite-scroller') ||
                         document.querySelector('main');
  
  if (!scrollContainer) {
    console.log('⚠️ No scroll container found, proceeding with visible content');
    return;
  }
  
  let lastMessageCount = 0;
  let currentMessageCount = 0;
  let noChangeCount = 0;
  const maxScrollAttempts = 50; // Prevent infinite loops
  let scrollAttempts = 0;
  
  chrome.runtime.sendMessage({ action: 'exportProgress', message: 'Loading full conversation history...' });
  
  while (scrollAttempts < maxScrollAttempts) {
    // Count current messages
    const allMessages = document.querySelectorAll('user-query, model-response, USER-QUERY, MODEL-RESPONSE');
    currentMessageCount = allMessages.length;
    
    // Update progress
    if (scrollAttempts % 5 === 0) {
      chrome.runtime.sendMessage({ 
        action: 'exportProgress', 
        message: `Loading messages... Found ${currentMessageCount} so far` 
      });
    }
    
    console.log(`📊 Scroll attempt ${scrollAttempts + 1}: Found ${currentMessageCount} messages`);
    
    // If no new messages loaded after several attempts, we're done
    if (currentMessageCount === lastMessageCount) {
      noChangeCount++;
      if (noChangeCount >= 3) {
        console.log('✅ No new messages loading, conversation fully loaded');
        break;
      }
    } else {
      noChangeCount = 0;
      lastMessageCount = currentMessageCount;
    }
    
    // Scroll up to load earlier messages
    scrollContainer.scrollTo({
      top: 0,
      behavior: 'auto' // Use 'auto' instead of 'smooth' for faster loading
    });
    
    // Wait for content to load
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Try scrolling up further if we're not at the top
    if (scrollContainer.scrollTop > 0) {
      scrollContainer.scrollTop = 0;
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    scrollAttempts++;
  }
  
  console.log(`✅ Finished loading. Total attempts: ${scrollAttempts}, Final message count: ${currentMessageCount}`);
  
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
  
  // Based on debug data, look for the conversation container
  const conversationContainer = document.querySelector('.conversation-container') || 
                               document.querySelector('#chat-history') ||
                               document.querySelector('.chat-history') ||
                               document.querySelector('infinite-scroller') ||
                               document.body;
  
  console.log('Found conversation container:', conversationContainer);
  
  // Extract USER queries - these are the user's questions
  const userQueries = conversationContainer.querySelectorAll('user-query, USER-QUERY');
  console.log('Found', userQueries.length, 'user query elements');
  
  userQueries.forEach((userQuery, index) => {
    // Look for the actual text content within the user query
    const queryTextElements = userQuery.querySelectorAll('.query-text-line, .query-text, p');
    let userText = '';
    const seenTexts = new Set(); // Prevent duplicates
    
    queryTextElements.forEach(element => {
      const text = element.textContent?.trim();
      if (text && !text.includes('Opens in a new window') && !seenTexts.has(text)) {
        seenTexts.add(text);
        userText += text + ' ';
      }
    });
    
    if (userText.trim()) {
      messages.push({
        role: 'user',
        content: userText.trim(),
        timestamp: new Date().toISOString(),
        element_id: `user-query-${index}`,
        word_count: userText.trim().split(/\s+/).length
      });
      console.log('Extracted user message:', userText.trim());
    }
  });
  
  // Extract MODEL responses - these are Gemini's answers
  const modelResponses = conversationContainer.querySelectorAll('model-response, MODEL-RESPONSE');
  console.log('Found', modelResponses.length, 'model response elements');
  
  modelResponses.forEach((modelResponse, index) => {
    // Look for the markdown content within the model response
    const messageContent = modelResponse.querySelector('message-content, MESSAGE-CONTENT');
    const markdownDiv = messageContent?.querySelector('.markdown');
    
    if (markdownDiv) {
      let assistantText = '';
      const processedElements = new Set(); // Prevent duplicates
      
      // Extract paragraphs first (main content)
      const paragraphs = markdownDiv.querySelectorAll('p');
      paragraphs.forEach(p => {
        const text = p.textContent?.trim();
        if (text && text.length > 5 && !processedElements.has(text)) {
          processedElements.add(text);
          assistantText += text + '\n\n';
        }
      });
      
      // Extract list items
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
      
      // Clean up the text
      assistantText = assistantText
        .replace(/\*\*(.*?)\*\*/g, '$1') // Remove markdown bold markers
        .replace(/\n\n+/g, '\n\n') // Remove excessive newlines
        .replace(/Analysis\s*Analysis/gi, 'Analysis') // Remove duplicate Analysis
        .replace(/Read documents\s*/gi, '') // Remove "Read documents"
        .replace(/Response finalized\s*/gi, '') // Remove "Response finalized"
        .trim();
      
      if (assistantText && assistantText.length > 20) {
        messages.push({
          role: 'assistant',
          content: assistantText,
          timestamp: new Date().toISOString(),
          element_id: `model-response-${index}`,
          word_count: assistantText.split(/\s+/).length
        });
        console.log('Extracted assistant message:', assistantText.substring(0, 100) + '...');
      }
    }
  });
  
  // If we didn't find messages using the specific elements, fall back to the debug approach
  if (messages.length === 0) {
    console.log('Falling back to debug-style extraction...');
    
    // Look for the user question
    const userTextElement = document.querySelector('.query-text-line');
    if (userTextElement) {
      const userText = userTextElement.textContent?.trim();
      if (userText) {
        messages.push({
          role: 'user',
          content: userText,
          timestamp: new Date().toISOString(),
          element_id: 'fallback-user-query',
          word_count: userText.split(/\s+/).length
        });
      }
    }
    
    // Look for the response content
    const responseElement = document.querySelector('message-content .markdown');
    if (responseElement) {
      let responseText = '';
      const paragraphs = responseElement.querySelectorAll('p, li');
      paragraphs.forEach(p => {
        const text = p.textContent?.trim();
        if (text && text.length > 10) {
          if (p.tagName === 'LI') {
            responseText += '• ' + text + '\n';
          } else {
            responseText += text + '\n\n';
          }
        }
      });
      
      if (responseText.trim()) {
        messages.push({
          role: 'assistant',
          content: responseText.trim(),
          timestamp: new Date().toISOString(),
          element_id: 'fallback-assistant-response',
          word_count: responseText.trim().split(/\s+/).length
        });
      }
    }
  }
  
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
  
  console.log('Final extracted chat data:', chatData);
  return chatData;
}
async function extractAllChatsData() {
  console.log('Extracting all chats data...');
  
  const allChats = [];
  
  // Try to find chat history in sidebar
  const sidebarSelectors = [
    '[data-test-id="chat-history"]',
    'nav[role="navigation"]',
    '.chat-history',
    'aside',
    '[role="navigation"]',
    'nav'
  ];
  
  let sidebar = null;
  for (const selector of sidebarSelectors) {
    sidebar = document.querySelector(selector);
    if (sidebar) {
      console.log('Found sidebar with selector:', selector);
      break;
    }
  }
  
  if (sidebar) {
    const chatLinks = Array.from(sidebar.querySelectorAll('a, button, div[role="button"]'));
    
    chatLinks.forEach((link, index) => {
      const title = link.textContent?.trim();
      if (title && title.length > 0 && !title.match(/^(New|Start|Menu|Settings)/i)) {
        allChats.push({
          id: 'sidebar-chat-' + index,
          title: title,
          timestamp: new Date().toISOString(),
          url: link.href || window.location.href,
          type: 'sidebar_reference',
          messages: []
        });
      }
    });
  }
  
  // Always include current chat data
  try {
    const currentChat = await extractCurrentChatData();
    currentChat.type = 'full_conversation';
    allChats.unshift(currentChat);
  } catch (error) {
    console.warn('Could not extract current chat:', error);
  }
  
  console.log(`Extracted ${allChats.length} total chats`);
  return allChats;
}

async function downloadAsJSON(data, filename) {
  return new Promise((resolve, reject) => {
    try {
      const exportData = {
        export_info: {
          timestamp: new Date().toISOString(),
          source: 'Gemini Chat Exporter v1.1.0',
          total_chats: data.length,
          total_messages: data.reduce((sum, chat) => sum + (chat.messages?.length || 0), 0)
        },
        chats: data
      };
      
      const jsonString = JSON.stringify(exportData, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `${filename}-${new Date().toISOString().split('T')[0]}.json`;
      a.style.display = 'none';
      
      document.body.appendChild(a);
      a.click();
      
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        resolve();
      }, 100);
      
    } catch (error) {
      reject(error);
    }
  });
}

console.log('Gemini Chat Exporter v1.1.0 loaded - Auto-scroll for full conversation history');