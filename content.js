// Wait for page to load before setting up listeners
let manifest = chrome.runtime.getManifest();
let isReady = false;
let selectorConfig = null; // Global config instance

// Configuration loader and selector system
class GeminiSelectorConfig {
  constructor() {
    this.config = null;
    this.currentVersion = "v1"; // default to current working version
  }

  async loadConfig(version = this.currentVersion) {
    try {
      // Chrome extension can load bundled JSON files
      const configUrl = chrome.runtime.getURL(`selectors/gemini-selectors-${version}.json`);
      const response = await fetch(configUrl);
      this.config = await response.json();
      console.log(`✅ Loaded selector config ${this.config.version}: ${this.config.description}`);
      return true;
    } catch (error) {
      console.error(`❌ Failed to load config ${version}:`, error);
      
      // Fallback to default version
      if (version !== "v1") {
        console.log("⚠️ Falling back to v1 config...");
        return this.loadConfig("v1");
      }
      return false;
    }
  }

  // Get selectors with built-in fallback chain
  getSelectors(category, subcategory) {
    if (!this.config) {
      throw new Error("Config not loaded. Call loadConfig() first.");
    }
    
    const selectors = this.config.selectors[category]?.[subcategory];
    if (!selectors) {
      console.warn(`⚠️ No selectors found for ${category}.${subcategory}`);
      return [];
    }
    
    // Always return as array for consistent iteration
    return Array.isArray(selectors) ? selectors : [selectors];
  }

  // Try multiple selectors until one finds elements
  querySelector(category, subcategory, parent = document) {
    const selectors = this.getSelectors(category, subcategory);
    
    for (const selector of selectors) {
      try {
        const elements = parent.querySelectorAll(selector);
        if (elements.length > 0) {
          console.log(`✅ Found ${elements.length} elements with selector: ${selector}`);
          return elements;
        }
      } catch (error) {
        console.warn(`⚠️ Invalid selector "${selector}":`, error);
      }
    }
    
    console.warn(`❌ No elements found for ${category}.${subcategory} with any selector`);
    return [];
  }

  // Get single element (first match)
  querySelectorFirst(category, subcategory, parent = document) {
    const elements = this.querySelector(category, subcategory, parent);
    return elements.length > 0 ? elements[0] : null;
  }

  // Get conversation ID pattern for current config
  getConversationIdPattern() {
    const titleConfig = this.config.selectors.title;
    return {
      attribute: titleConfig.conversationIdAttribute,
      pattern: titleConfig.conversationIdPattern,
      attributeFallback: titleConfig.conversationIdAttributeFallback,
      patternFallback: titleConfig.conversationIdPatternFallback
    };
  }

  // Get timeout values
  getTimeouts() {
    return this.config.timeouts || {
      scrollDelay: 300,
      maxScrollAttempts: 8,
      stabilityChecks: 2,
      totalTimeout: 15000
    };
  }
}

// Initialize configuration system
async function initializeSelectorConfig() {
  if (!selectorConfig) {
    selectorConfig = new GeminiSelectorConfig();
    
    // Try to load the latest config, fallback to v1 if needed
    const configLoaded = await selectorConfig.loadConfig("v2") || 
                         await selectorConfig.loadConfig("v1");
    
    if (!configLoaded) {
      console.error("❌ Failed to load any selector configuration!");
      throw new Error("Could not initialize selector configuration");
    }
  }
  
  return selectorConfig;
}

function debugDOMStructure() {
  console.log('=== DOM DEBUG INFO ===');
  console.log('Current URL:', window.location.href);
  console.log('Page title:', document.title);
  console.log('Document ready state:', document.readyState);

  // Use configurable debug selectors if available
  let containers = [
    '#chat-history',
    'infinite-scroller',
    'div.conversation-container',
    'user-query',
    'model-response',
    'main[role="main"]',
    '[data-testid]'
  ];

  if (selectorConfig) {
    try {
      containers = selectorConfig.getSelectors('debug', 'containers');
    } catch (error) {
      console.log('Using default debug selectors (config not loaded)');
    }
  }

  containers.forEach(selector => {
    const elements = document.querySelectorAll(selector);
    console.log(`${selector}: ${elements.length} elements found`);
    if (elements.length > 0) {
      console.log('First element:', elements[0]);
    }
  });

  // Check for any elements with data attributes that might be messages
  const allDivs = document.querySelectorAll('div');
  console.log(`Total divs found: ${allDivs.length}`);

  // Look for elements that might contain conversation data
  const potentialMessages = Array.from(allDivs).filter(div => {
    const text = div.innerText?.trim();
    return text && text.length > 20 && text.length < 2000;
  });
  console.log(`Potential message elements: ${potentialMessages.length}`);

  // Log the first few for inspection
  potentialMessages.slice(0, 3).forEach((el, i) => {
    console.log(`Potential message ${i}:`, {
      tagName: el.tagName,
      classes: el.className,
      id: el.id,
      textPreview: el.innerText?.slice(0, 100)
    });
  });
}

function initialize() {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', async () => {
      isReady = true;
      // Initialize config when DOM is ready
      try {
        await initializeSelectorConfig();
      } catch (error) {
        console.error("Failed to initialize selector config:", error);
      }
    });
  } else {
    isReady = true;
    // Initialize config immediately
    initializeSelectorConfig().catch(error => {
      console.error("Failed to initialize selector config:", error);
    });
  }
}

initialize();

// Listen for messages from popup
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
      return true; // Will respond asynchronously

    } else if (message.action === 'exportAllChats') {
      exportAllChats().then(result => {
        sendResponse(result);
      }).catch(error => {
        sendResponse({ success: false, error: error.message });
      });
      return true; // Will respond asynchronously
    } else if (message.action === 'debug') {
      debugDOMStructure();
      sendResponse({ success: true });
      return false; // Synchronous response
    }
  } catch (error) {
    console.error('Content script error:', error);
    sendResponse({ success: false, error: error.message });
  }
});

// Updated extractConversationTitle function using configurable selectors
async function extractConversationTitle() {
  console.log('🔍 Extracting conversation title using configurable selectors...');

  const config = await initializeSelectorConfig();
  
  // Get current conversation ID from URL
  const currentUrl = window.location.href;
  const currentId = currentUrl.split('/').pop();
  console.log('📍 Current conversation ID:', currentId);

  if (!currentId) {
    console.log('❌ No conversation ID found in URL');
    return null;
  }

  // Use configurable selectors to find sidebar conversations
  const conversationItems = config.querySelector('conversation', 'sidebarItems');
  console.log(`📋 Found ${conversationItems.length} conversation items in sidebar`);

  // Get conversation ID pattern from config
  const { attribute, pattern, attributeFallback, patternFallback } = config.getConversationIdPattern();

  for (let i = 0; i < conversationItems.length; i++) {
    const item = conversationItems[i];
    const text = item.innerText?.trim();

    // Try primary pattern first
    const primaryAttrValue = item.getAttribute(attribute);
    const primarySearchPattern = pattern.replace('{id}', currentId);
    
    if (primaryAttrValue && primaryAttrValue.includes(primarySearchPattern)) {
      console.log(`✅ Found matching conversation (primary): "${text}"`);
      return text;
    }

    // Try fallback pattern if available
    if (attributeFallback && patternFallback) {
      const fallbackAttrValue = item.getAttribute(attributeFallback);
      const fallbackSearchPattern = patternFallback.replace('{id}', currentId);
      
      if (fallbackAttrValue && fallbackAttrValue.includes(fallbackSearchPattern)) {
        console.log(`✅ Found matching conversation (fallback): "${text}"`);
        return text;
      }
    }
  }

  console.log('❌ No matching conversation found in sidebar');

  // Fallback: try to generate title from first user message using configurable selectors
  const fallbackSelectors = config.getSelectors('title', 'fallbackSelectors');
  for (const selector of fallbackSelectors) {
    const firstUserMessage = document.querySelector(selector);
    if (firstUserMessage) {
      const firstMessage = firstUserMessage.innerText?.trim();
      if (firstMessage && firstMessage.length > 0) {
        const generatedTitle = firstMessage.length > 50 
          ? firstMessage.substring(0, 47) + '...' 
          : firstMessage;
        console.log(`💡 Generated title from first message: "${generatedTitle}"`);
        return generatedTitle;
      }
    }
  }

  console.log('❌ No conversation title found, using fallback');
  return null;
}

async function exportCurrentChat() {
  try {
    chrome.runtime.sendMessage({ action: 'exportProgress', message: 'Initializing configurable selectors...' });

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
    chrome.runtime.sendMessage({ action: 'exportProgress', message: 'Scanning chat history with configurable selectors...' });

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

/**
 * Optimized scrolling function using configurable timeouts
 */
async function scrollToTopToLoadAll(scrollableElement, config) {
  if (!scrollableElement) {
    console.warn('⚠️ Scrollable element not provided for scrollToTopToLoadAll. Auto-scrolling aborted.');
    return;
  }

  const timeouts = config.getTimeouts();
  const { scrollDelay, maxAttempts, stabilityChecks } = timeouts;

  console.log(`🔄 Starting auto-scroll for element:`, scrollableElement);
  console.log(`⚙️ Config: delay=${scrollDelay}ms, maxAttempts=${maxAttempts}, stability=${stabilityChecks}`);

  const startTime = Date.now();
  let attempts = 0;
  let previousScrollHeight = -1;
  let stableCycles = 0;

  await new Promise(resolve => setTimeout(resolve, 100));

  while (attempts < maxAttempts) {
    const attemptStart = Date.now();
    previousScrollHeight = scrollableElement.scrollHeight;
    scrollableElement.scrollTop = 0;

    console.log(`📜 Scroll attempt #${attempts + 1}/${maxAttempts}: scrollTop set to 0. Current scrollHeight: ${scrollableElement.scrollHeight}`);

    await new Promise(resolve => setTimeout(resolve, scrollDelay));

    if (scrollableElement.scrollHeight === previousScrollHeight) {
      stableCycles++;
      console.log(`✅ Scroll height stable for ${stableCycles} cycle(s). Required: ${stabilityChecks}`);
      if (stableCycles >= stabilityChecks) {
        console.log('🎯 Scroll height stable. Assuming all content loaded.');
        break;
      }
    } else {
      stableCycles = 0;
      console.log(`📈 Scroll height changed from ${previousScrollHeight} to ${scrollableElement.scrollHeight}`);
    }

    attempts++;
    const attemptDuration = Date.now() - attemptStart;
    console.log(`⏱️ Attempt ${attempts} completed in ${attemptDuration}ms`);
  }

  const totalDuration = Date.now() - startTime;
  console.log(`🏁 Scrolling completed in ${totalDuration}ms after ${attempts} attempts`);

  if (attempts >= maxAttempts) {
    console.warn('⚠️ Max scroll attempts reached. Not all content may be loaded.');
  }

  await new Promise(resolve => setTimeout(resolve, 200));
}

// Updated extractCurrentChatData function using configurable selectors
async function extractCurrentChatData() {
  console.log('📊 Extracting current chat data using configurable selectors...');

  const config = await initializeSelectorConfig();
  const timeouts = config.getTimeouts();

  // Add overall timeout protection
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Extract timeout after ' + timeouts.totalTimeout/1000 + ' seconds')), timeouts.totalTimeout);
  });

  const extractPromise = async () => {
    chrome.runtime.sendMessage({ action: 'exportProgress', message: 'Looking for scrollable content...' });

    let scrollableChatArea = null;

    // Use configurable selectors for finding scrollable areas
    const chatHistoryElements = config.querySelector('scrolling', 'chatHistory');
    if (chatHistoryElements.length > 0) {
      const chatHistoryContainer = chatHistoryElements[0];
      const infiniteScrollers = config.querySelector('scrolling', 'infiniteScroller', chatHistoryContainer);
      
      if (infiniteScrollers.length > 0) {
        scrollableChatArea = infiniteScrollers[0];
        console.log("✅ Found scrollable area using config:", scrollableChatArea);
      } else {
        console.warn("⚠️ Could not find infinite scroller, using chat history container.");
        scrollableChatArea = chatHistoryContainer;
      }
    }

    // Fallback to main content area
    if (!scrollableChatArea || scrollableChatArea.scrollHeight <= scrollableChatArea.clientHeight) {
      if (scrollableChatArea) {
        console.log(`ℹ️ Selected element is not scrollable (scrollHeight: ${scrollableChatArea.scrollHeight}, clientHeight: ${scrollableChatArea.clientHeight}).`);
      }
      console.warn("⚠️ Primary scroll target not found, trying main content fallback...");
      
      const mainElements = config.querySelector('scrolling', 'mainContent');
      if (mainElements.length > 0) {
        scrollableChatArea = mainElements[0];
        console.log("✅ Using main content area:", scrollableChatArea);
      }
    }

    // Optionally scroll to load all content (currently disabled but configurable)
    if (scrollableChatArea && scrollableChatArea.scrollHeight > scrollableChatArea.clientHeight) {
      // chrome.runtime.sendMessage({ action: 'exportProgress', message: 'Loading chat history...' });
      // await scrollToTopToLoadAll(scrollableChatArea, config);
    } else if (scrollableChatArea) {
      console.log("ℹ️ Scrollable area is not currently scrollable. Skipping auto-scroll.");
    } else {
      console.warn('⚠️ Could not identify a suitable scrollable chat area. Auto-scrolling skipped.');
    }

    chrome.runtime.sendMessage({ action: 'exportProgress', message: 'Extracting messages...' });

    await new Promise(resolve => setTimeout(resolve, 300));

    // Extract messages using configurable selectors
    const messages = [];
    const turnContainers = config.querySelector('conversation', 'containers');

    console.log(`📝 Found ${turnContainers.length} conversation containers`);

    turnContainers.forEach((turnElement, turnIndex) => {
      // Extract user message using configurable selectors
      const userQueryElements = config.querySelector('messages', 'userQuery', turnElement);
      
      for (const userQueryElement of userQueryElements) {
        const userTextElements = config.querySelector('messages', 'userText', userQueryElement);
        
        for (const userTextElement of userTextElements) {
          const content = userTextElement.innerText?.trim();
          if (content) {
            messages.push({
              role: 'user',
              content: content,
              timestamp: new Date().toISOString(),
              element_id: userQueryElement.id || `user-message-${turnIndex}-${Date.now()}`,
              element_classes: userQueryElement.className || '',
              word_count: content.split(/\s+/).filter(word => word.length > 0).length
            });
            break;
          }
        }
        if (messages.length > 0 && messages[messages.length - 1].role === 'user') break;
      }

      // Extract model response using configurable selectors
      const modelResponseElements = config.querySelector('messages', 'modelResponse', turnElement);
      
      for (const modelResponseElement of modelResponseElements) {
        const contentElements = config.querySelector('messages', 'modelContent', modelResponseElement);
        
        for (const contentWrapper of contentElements) {
          const tempContentDiv = document.createElement('div');
          tempContentDiv.innerHTML = contentWrapper.innerHTML;

          // Handle code blocks using configurable selectors
          const codeBlockSelectors = config.getSelectors('messages', 'codeBlocks');
          const codeBlockSelector = codeBlockSelectors.join(', ');
          const codeBlocks = tempContentDiv.querySelectorAll(codeBlockSelector);
          
          codeBlocks.forEach((block) => {
            const codeContent = block.innerText || block.textContent || '';
            const preformattedText = document.createTextNode(`\n\`\`\`\n${codeContent.trim()}\n\`\`\`\n`);
            block.parentNode.replaceChild(preformattedText, block);
          });

          let content = tempContentDiv.innerText.trim();
          content = content
            .replace(/\n\s*\n\s*\n/g, '\n\n')
            .replace(/Analysis\s*Analysis/g, 'Analysis')
            .trim();

          if (content) {
            messages.push({
              role: 'assistant',
              content: content,
              timestamp: new Date().toISOString(),
              element_id: modelResponseElement.id || `model-message-${turnIndex}-${Date.now()}`,
              element_classes: modelResponseElement.className || '',
              word_count: content.split(/\s+/).filter(word => word.length > 0).length
            });
            break;
          }
        }
        if (messages.length > 0 && messages[messages.length - 1].role === 'assistant') break;
      }
    });

    // Extract title using configurable approach
    let title = await extractConversationTitle();
    
    // Fallback to cleaned document title if no conversation title found
    if (!title) {
      title = document.title || 'Gemini Chat';
      if (title.includes('Gemini')) {
        title = title.replace(/\s*[-–—]\s*Gemini.*$/, '').trim() || 'Gemini Chat';
      }
    }

    const chatData = {
      id: 'current-chat-' + Date.now(),
      title: title,
      timestamp: new Date().toISOString(),
      url: window.location.href,
      messageCount: messages.length,
      messages: messages,
      extractedWith: {
        selectorVersion: config.config.version,
        selectorDescription: config.config.description
      }
    };

    console.log('✅ Final extracted chat data:', chatData);
    return chatData;
  };

  // Race between extraction and timeout
  return Promise.race([extractPromise(), timeoutPromise]);
}

async function extractAllChatsData() {
  console.log('📚 Extracting all chats data using configurable selectors...');

  const config = await initializeSelectorConfig();
  const allChats = [];

  // Use configurable selectors to find sidebar
  const sidebarElements = config.querySelector('conversation', 'sidebarItems');
  
  if (sidebarElements.length > 0) {
    console.log(`📋 Found ${sidebarElements.length} sidebar conversation items`);

    sidebarElements.forEach((item, index) => {
      const title = item.textContent?.trim();
      if (title && title.length > 0 && !title.match(/^(New|Start|Menu|Settings)/i)) {
        // Try to extract link if available
        const link = item.querySelector('a');
        allChats.push({
          id: 'sidebar-chat-' + index,
          title: title,
          timestamp: new Date().toISOString(),
          url: link?.href || window.location.href,
          type: 'sidebar_reference',
          messages: [] // Sidebar only contains titles, not full messages
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
    console.warn('⚠️ Could not extract current chat:', error);
  }

  console.log(`📊 Extracted ${allChats.length} total chats using configurable selectors`);
  return allChats;
}

/**
 * Sanitizes a string to be safe for use as a filename.
 */
function sanitizeFilename(name, defaultName = 'Untitled_Chat', maxLength = 100) {
  if (typeof name !== 'string' || !name.trim()) {
    return defaultName;
  }

  let sanitized = name.replace(/[<>:"\/\\|?*\x00-\x1F]/g, '_');
  sanitized = sanitized.replace(/_+/g, '_');
  sanitized = sanitized.replace(/^[_.\s]+|[_.\s]+$/g, '').trim();

  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength).trim();
    sanitized = sanitized.replace(/_+$/, '');
  }

  if (!sanitized) {
    return defaultName;
  }

  return sanitized;
}

async function downloadAsJSON(data, baseFilenamePrefix) {
  return new Promise((resolve, reject) => {
    try {
      const exportData = {
        export_info: {
          timestamp: new Date().toISOString(),
          source: `${manifest.name} v${manifest.version}`,
          selectorConfig: selectorConfig ? {
            version: selectorConfig.config.version,
            description: selectorConfig.config.description
          } : "config not loaded",
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

      const now = new Date();
      const datePart = now.getFullYear() +
        '-' + String(now.getMonth() + 1).padStart(2, '0') +
        '-' + String(now.getDate()).padStart(2, '0');
      const timePart = String(now.getHours()).padStart(2, '0') +
        '-' + String(now.getMinutes()).padStart(2, '0');

      const dateTimeSuffix = `${datePart}_${timePart}`;

      let chatTitleForFilename;
      if (baseFilenamePrefix === 'gemini-current-chat' && data && data.length === 1 && data[0] && data[0].title) {
        chatTitleForFilename = sanitizeFilename(data[0].title, 'Current_Chat');
      } else {
        chatTitleForFilename = sanitizeFilename(baseFilenamePrefix, 'Exported_Chats');
      }

      a.download = `${chatTitleForFilename}-${dateTimeSuffix}.json`;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();

      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        resolve();
      }, 100);

    } catch (error) {
      console.error('DownloadAsJSON error:', error);
      reject(error);
    }
  });
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

// Log that content script is loaded with config info
console.log(`🚀 ${manifest.name} content script v${manifest.version} loaded with configurable selectors`);
