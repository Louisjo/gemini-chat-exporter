// Wait for page to load before setting up listeners
let manifest = chrome.runtime.getManifest();
let isReady = false;

function debugDOMStructure() {
  console.log('=== DOM DEBUG INFO ===');
  console.log('Current URL:', window.location.href);
  console.log('Page title:', document.title);
  console.log('Document ready state:', document.readyState);

  // Check for common Gemini containers
  const containers = [
    '#chat-history',
    'infinite-scroller',
    'div.conversation-container',
    'user-query',
    'model-response',
    'main[role="main"]',
    '[data-testid]'
  ];

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
    document.addEventListener('DOMContentLoaded', () => {
      isReady = true;
    });
  } else {
    isReady = true;
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

/**
 * Attempts to scroll a given element to its top to load all dynamically-loaded content.
 * It waits after each scroll and checks if new content has loaded (by observing scrollHeight).
 * @param {Element} scrollableElement The HTML element to scroll.
 * @param {number} scrollDelayMs Delay in milliseconds to wait after each scroll attempt.
 * @param {number} maxAttempts Maximum number of scroll attempts.
 * @param {number} stabilityChecksRequired How many consecutive times scrollHeight must be stable.
 */
/**
 * Attempts to scroll a given element to its top to load all dynamically-loaded content.
 * OPTIMIZED VERSION with much shorter timeouts and better logging
 */
async function scrollToTopToLoadAll(scrollableElement, scrollDelayMs = 300, maxAttempts = 8, stabilityChecksRequired = 2) {
  if (!scrollableElement) {
    console.warn('Scrollable element not provided for scrollToTopToLoadAll. Auto-scrolling aborted.');
    return;
  }

  console.log(`Starting OPTIMIZED auto-scroll for element:`, scrollableElement);
  console.log(`Config: delay=${scrollDelayMs}ms, maxAttempts=${maxAttempts}, stability=${stabilityChecksRequired}`);

  const startTime = Date.now();
  let attempts = 0;
  let previousScrollHeight = -1;
  let stableCycles = 0;

  // Initial small pause for any pending UI updates before starting
  await new Promise(resolve => setTimeout(resolve, 100));

  while (attempts < maxAttempts) {
    const attemptStart = Date.now();
    previousScrollHeight = scrollableElement.scrollHeight;
    scrollableElement.scrollTop = 0; // Scroll to the very top

    console.log(`Scroll attempt #${attempts + 1}/${maxAttempts}: scrollTop set to 0. Current scrollHeight: ${scrollableElement.scrollHeight}, Previous: ${previousScrollHeight}`);

    // Much shorter wait time
    await new Promise(resolve => setTimeout(resolve, scrollDelayMs));

    if (scrollableElement.scrollHeight === previousScrollHeight) {
      stableCycles++;
      console.log(`Scroll height stable for ${stableCycles} cycle(s) at ${scrollableElement.scrollHeight}. Required: ${stabilityChecksRequired}`);
      if (stableCycles >= stabilityChecksRequired) {
        console.log('Scroll height stable. Assuming all content loaded.');
        break;
      }
    } else {
      stableCycles = 0; // Reset counter if scroll height changed
      console.log(`Scroll height changed from ${previousScrollHeight} to ${scrollableElement.scrollHeight}. More content likely loaded.`);
    }

    attempts++;
    const attemptDuration = Date.now() - attemptStart;
    console.log(`Attempt ${attempts} completed in ${attemptDuration}ms`);
  }

  const totalDuration = Date.now() - startTime;
  console.log(`Scrolling completed in ${totalDuration}ms after ${attempts} attempts`);

  if (attempts >= maxAttempts) {
    console.warn('Max scroll attempts reached. Not all content may be loaded.');
  }

  // Final small pause to ensure rendering completes
  await new Promise(resolve => setTimeout(resolve, 200));
}

// UPDATED: Modified extractCurrentChatData with timeout protection
async function extractCurrentChatData() {
  console.log('Extracting current chat data (OPTIMIZED with timeout protection)...');

  // Add overall timeout protection
  const TOTAL_TIMEOUT = 15000; // 15 seconds max
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Extract timeout after 15 seconds')), TOTAL_TIMEOUT);
  });

  const extractPromise = async () => {
    // Send progress update
    chrome.runtime.sendMessage({ action: 'exportProgress', message: 'Looking for scrollable content...' });

    let scrollableChatArea = null;

    // Attempt 1: Target the 'infinite-scroller' within '#chat-history'
    const chatHistoryContainer = document.getElementById('chat-history');
    if (chatHistoryContainer) {
      scrollableChatArea = chatHistoryContainer.querySelector('infinite-scroller');
      if (scrollableChatArea) {
        console.log("Successfully identified scrollable area: #chat-history > infinite-scroller", scrollableChatArea);
      } else {
        console.warn("Could not find 'infinite-scroller' inside #chat-history. Attempting to use #chat-history itself.");
        scrollableChatArea = chatHistoryContainer;
      }
    }

    // Attempt 2: Fallback to main
    if (!scrollableChatArea || scrollableChatArea.scrollHeight <= scrollableChatArea.clientHeight) {
      if (scrollableChatArea) {
        console.log(`Selected element is not scrollable (scrollHeight: ${scrollableChatArea.scrollHeight}, clientHeight: ${scrollableChatArea.clientHeight}).`);
      }
      console.warn("Primary scroll target not found or not scrollable. Attempting fallback: 'main[role=\"main\"]'.");
      scrollableChatArea = document.querySelector('main[role="main"]');
      if (scrollableChatArea) {
        console.log("Identified scrollable area with fallback: main[role=\"main\"]", scrollableChatArea);
      }
    }

    // If a scrollable area is found, attempt to scroll it with MUCH shorter timeouts
    if (scrollableChatArea && scrollableChatArea.scrollHeight > scrollableChatArea.clientHeight) {
      chrome.runtime.sendMessage({ action: 'exportProgress', message: 'Loading chat history (this may take a moment)...' });

      // OPTIMIZED: Much shorter parameters - max 8 attempts, 300ms delay
      // await scrollToTopToLoadAll(scrollableChatArea, 300, 8, 2);
    } else if (scrollableChatArea) {
      console.log("Identified scrollable area is not currently scrollable. Skipping auto-scroll.", scrollableChatArea);
    } else {
      console.warn('Could not identify a suitable scrollable chat area. Auto-scrolling skipped.');
    }

    chrome.runtime.sendMessage({ action: 'exportProgress', message: 'Extracting messages...' });

    // Brief pause after scrolling
    await new Promise(resolve => setTimeout(resolve, 300));

    // Rest of extraction logic...
    const messages = [];
    const turnContainers = document.querySelectorAll('div.conversation-container');

    console.log(`Found ${turnContainers.length} turn containers after scrolling attempts.`);

    turnContainers.forEach((turnElement, turnIndex) => {
      // Attempt to extract user message
      const userQueryElement = turnElement.querySelector('user-query');
      if (userQueryElement) {
        const userTextElement = userQueryElement.querySelector('div.query-text > p.query-text-line');
        if (userTextElement) {
          const content = userTextElement.innerText.trim();
          if (content) {
            messages.push({
              role: 'user',
              content: content,
              timestamp: new Date().toISOString(),
              element_id: userQueryElement.id || `user-message-${turnIndex}-${Date.now()}`,
              element_classes: userQueryElement.className || '',
              word_count: content.split(/\s+/).filter(word => word.length > 0).length
            });
          }
        }
      }

      // Attempt to extract model response
      const modelResponseEntity = turnElement.querySelector('model-response');
      if (modelResponseEntity) {
        const contentWrapper = modelResponseEntity.querySelector('message-content div.markdown');
        if (contentWrapper) {
          const tempContentDiv = document.createElement('div');
          tempContentDiv.innerHTML = contentWrapper.innerHTML;

          const codeBlocks = tempContentDiv.querySelectorAll('pre, code, .code-block');
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
              element_id: modelResponseEntity.id || `model-message-${turnIndex}-${Date.now()}`,
              element_classes: modelResponseEntity.className || '',
              word_count: content.split(/\s+/).filter(word => word.length > 0).length
            });
          }
        }
      }
    });

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

    console.log('Final extracted chat data (OPTIMIZED version):', chatData);
    return chatData;
  };

  // Race between extraction and timeout
  return Promise.race([extractPromise(), timeoutPromise]);
}
// async function extractCurrentChatData() {
//   console.log('Extracting current chat data...');

//   // Wait a bit for dynamic content to load
//   await new Promise(resolve => setTimeout(resolve, 1000));

//   // Multiple selectors to find the chat container - UPDATED FOR CURRENT GEMINI
//   const containerSelectors = [
//     '[data-test-id="conversation-turn-list"]',
//     'main[role="main"]',
//     '[role="main"]',
//     'main',
//     '.conversation-container',
//     '[data-conversation-id]',
//     // New selectors for current Gemini interface
//     '[data-testid="conversation-turn-list"]',
//     '[data-testid="chat-messages"]',
//     '.chat-history',
//     '[jsname]', // Gemini uses jsname attributes
//     'div[class*="conversation"]'
//   ];

//   let chatContainer = null;
//   for (const selector of containerSelectors) {
//     chatContainer = document.querySelector(selector);
//     if (chatContainer) {
//       console.log('Found chat container with selector:', selector);
//       break;
//     }
//   }

//   if (!chatContainer) {
//     console.log('No specific container found, using document body');
//     chatContainer = document.body;
//   }

//   const messages = [];

//   // Enhanced message selectors for current Gemini interface
//   const messageSelectors = [
//     // Original selectors
//     '[data-test-id="conversation-turn"]',
//     '[data-message-author-role]',
//     '.conversation-turn',
//     '[role="presentation"]',
//     '.message-content',
//     'div[class*="turn"]',
//     'div[class*="message"]',
//     // New selectors for current Gemini
//     '[data-testid="conversation-turn"]',
//     '[data-testid="message"]',
//     'div[jsname][data-message-author-role]',
//     'div[jsname*="message"]',
//     // Look for specific Gemini conversation patterns
//     'article[data-message-author-role]',
//     'div[class*="conversation"] > div',
//     // Broader patterns that might catch messages
//     'div[data-message-author-role="user"]',
//     'div[data-message-author-role="model"]'
//   ];

//   let messageElements = [];
//   for (const selector of messageSelectors) {
//     messageElements = Array.from(chatContainer.querySelectorAll(selector));
//     if (messageElements.length > 0) {
//       console.log(`Found ${messageElements.length} messages with selector:`, selector);
//       break;
//     }
//   }

//   // Enhanced fallback: look for text patterns that suggest messages
//   if (messageElements.length === 0) {
//     console.log('Using enhanced fallback message detection');

//     // Look for divs that contain substantial text and might be messages
//     const allDivs = Array.from(chatContainer.querySelectorAll('div'));
//     messageElements = allDivs.filter(div => {
//       const text = div.innerText?.trim();
//       const hasSubstantialText = text && text.length > 20;
//       const notNavigation = !div.querySelector('nav, button[aria-label], input');
//       const notTooNested = div.querySelectorAll('div').length < 20;
//       const hasMessageIndicators = text && (
//         text.includes('whats it called') ||
//         text.includes('color') ||
//         text.includes('anime') ||
//         text.includes('Query successful') ||
//         div.querySelector('[data-message-author-role]')
//       );

//       return hasSubstantialText && notNavigation && notTooNested && (hasMessageIndicators || text.length > 100);
//     });

//     console.log(`Fallback found ${messageElements.length} potential message elements`);
//   }

//   console.log(`Processing ${messageElements.length} message elements`);

//   messageElements.forEach((element, index) => {
//     const messageData = extractMessageData(element, index);
//     if (messageData.content.trim() && messageData.content.length > 5) {
//       messages.push(messageData);
//     }
//   });

//   // Get page title
//   let title = document.title || 'Gemini Chat';
//   if (title.includes('Gemini')) {
//     title = title.replace(/\s*[-–—]\s*Gemini.*$/, '').trim() || 'Gemini Chat';
//   }

//   const chatData = {
//     id: 'current-chat-' + Date.now(),
//     title: title,
//     timestamp: new Date().toISOString(),
//     url: window.location.href,
//     messageCount: messages.length,
//     messages: messages
//   };

//   console.log('Extracted chat data:', chatData);
//   return chatData;
// }
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
    'nav',
    // New selectors for current Gemini
    '[data-testid="chat-history"]',
    '[data-testid="conversation-list"]',
    'div[jsname*="sidebar"]',
    'div[jsname*="history"]'
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
    // Look for chat links/buttons in sidebar
    const chatLinkSelectors = [
      'a[href*="/chat/"]',
      'button[data-chat-id]',
      'div[role="button"]',
      'a',
      'button',
      // New selectors
      'div[jsname][role="button"]',
      'div[data-testid*="chat"]'
    ];

    let chatLinks = [];
    for (const selector of chatLinkSelectors) {
      chatLinks = Array.from(sidebar.querySelectorAll(selector));
      if (chatLinks.length > 0) {
        console.log(`Found ${chatLinks.length} chat links with selector:`, selector);
        break;
      }
    }

    chatLinks.forEach((link, index) => {
      const title = link.textContent?.trim();
      if (title && title.length > 0 && !title.match(/^(New|Start|Menu|Settings)/i)) {
        allChats.push({
          id: 'sidebar-chat-' + index,
          title: title,
          timestamp: new Date().toISOString(),
          url: link.href || window.location.href,
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
    console.warn('Could not extract current chat:', error);
  }

  console.log(`Extracted ${allChats.length} total chats`);
  return allChats;
}

// function extractMessageData(element, index) {
//   // Enhanced role detection with more patterns
//   const roleAttributes = element.querySelector('[data-message-author-role]');
//   const userIndicators = [
//     '[data-message-author-role="user"]',
//     '.user-message',
//     '[class*="user"]',
//     // Look for text patterns
//     element => element.textContent?.includes('whats it called') || element.textContent?.includes('orange etc')
//   ];

//   const assistantIndicators = [
//     '[data-message-author-role="model"]',
//     '[data-message-author-role="assistant"]',
//     '.assistant-message',
//     '.model-message',
//     '[class*="assistant"]',
//     '[class*="model"]',
//     // Look for text patterns
//     element => element.textContent?.includes('Query successful') ||
//       element.textContent?.includes('color inversion') ||
//       element.textContent?.includes('Analysis')
//   ];

//   let role = 'unknown';

//   if (roleAttributes) {
//     const roleValue = roleAttributes.getAttribute('data-message-author-role');
//     role = roleValue === 'model' ? 'assistant' : roleValue;
//   } else {
//     // Check for role indicators including text patterns
//     const isUser = userIndicators.some(indicator => {
//       if (typeof indicator === 'function') {
//         return indicator(element);
//       }
//       return element.querySelector(indicator);
//     });

//     const isAssistant = assistantIndicators.some(indicator => {
//       if (typeof indicator === 'function') {
//         return indicator(element);
//       }
//       return element.querySelector(indicator);
//     });

//     if (isUser) role = 'user';
//     else if (isAssistant) role = 'assistant';
//     else {
//       // Enhanced fallback: check content patterns
//       const content = element.innerText || element.textContent || '';
//       if (content.includes('whats it called') || content.length < 50) {
//         role = 'user';
//       } else if (content.includes('color inversion') || content.includes('Analysis') || content.length > 100) {
//         role = 'assistant';
//       } else {
//         role = index % 2 === 0 ? 'user' : 'assistant';
//       }
//     }
//   }

//   // Enhanced content extraction
//   let content = '';

//   // Look for specific content containers
//   const contentSelectors = [
//     '[data-message-content]',
//     '.message-content',
//     '.content',
//     'p',
//     'div'
//   ];

//   let contentElement = element;
//   for (const selector of contentSelectors) {
//     const found = element.querySelector(selector);
//     if (found && found.innerText?.trim()) {
//       contentElement = found;
//       break;
//     }
//   }

//   // Preserve code blocks and formatting
//   const codeBlocks = contentElement.querySelectorAll('pre, code, .code-block');
//   codeBlocks.forEach((block, i) => {
//     const codeContent = block.innerText || block.textContent;
//     block.setAttribute('data-code-block', i);
//     block.innerHTML = `\n\`\`\`\n${codeContent}\n\`\`\`\n`;
//   });

//   // Get the text content
//   content = contentElement.innerText || contentElement.textContent || '';

//   // Clean up content
//   content = content
//     .replace(/\n\s*\n\s*\n/g, '\n\n') // Remove excessive newlines
//     .replace(/Analysis\s*Analysis/g, 'Analysis') // Remove duplicate "Analysis"
//     .trim();

//   return {
//     role: role,
//     content: content,
//     timestamp: new Date().toISOString(),
//     element_id: element.id || `message-${index}`,
//     element_classes: element.className || '',
//     word_count: content.split(/\s+/).filter(word => word.length > 0).length
//   };
// }

/**
 * Sanitizes a string to be safe for use as a filename.
 * Removes/replaces characters forbidden on major OSes and cleans up the result.
 * @param {string} name The original string to sanitize.
 * @param {string} defaultName A name to use if sanitization results in an empty string.
 * @param {number} maxLength Max length for the sanitized name (excluding suffix).
 * @returns {string} A sanitized string suitable for use in a filename.
 */
function sanitizeFilename(name, defaultName = 'Untitled_Chat', maxLength = 100) {
  if (typeof name !== 'string' || !name.trim()) {
    return defaultName;
  }

  // Remove or replace characters forbidden in Windows, macOS, and Linux filenames.
  // Common forbidden characters: / \ ? % * : | " < > and null/control characters.
  let sanitized = name.replace(/[<>:"\/\\|?*\x00-\x1F]/g, '_');

  // Replace multiple consecutive underscores (or other replacements) with a single one
  sanitized = sanitized.replace(/_+/g, '_');

  // Remove leading/trailing underscores, periods, or spaces that might have been created
  sanitized = sanitized.replace(/^[_.\s]+|[_.\s]+$/g, '').trim();

  // Truncate to a reasonable length to avoid overly long filenames
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength).trim();
    // Ensure it doesn't end with an underscore after truncation
    sanitized = sanitized.replace(/_+$/, '');
  }

  // If, after all that, the string is empty (e.g., consisted only of forbidden chars), use default
  if (!sanitized) {
    return defaultName;
  }

  return sanitized;
}
async function downloadAsJSON(data, baseFilenamePrefix) {
  return new Promise((resolve, reject) => {
    try {
      // Get manifest data


      const exportData = {
        export_info: {
          timestamp: new Date().toISOString(),
          // Dynamically use the name and version from manifest.json
          source: `${manifest.name} v${manifest.version}`,
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

// Log that content script is loaded
console.log(`${manifest.name} content script v${manifest.version} per manifest`);

