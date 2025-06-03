# Selector Update Guide

This guide helps you update the extension when Gemini changes their interface and breaks the current selectors.

## 🚨 When to Update Selectors

**Signs the extension needs selector updates:**
- Extension shows "No messages found" despite visible conversation
- Wrong conversation titles being extracted
- Debug mode shows "0 elements found" for key selectors
- Export hangs or times out consistently

## 🔍 Step 1: Diagnose the Problem

### Run Debug Mode
1. Load the extension on a Gemini page
2. Click "Debug DOM Structure"
3. Open browser console (F12)
4. Look for messages like:
   ```
   ❌ No elements found for conversation.containers with any selector
   ⚠️ No selectors found for messages.userQuery
   ```

### Identify Broken Selectors
Common selector categories that break:
- **Conversation containers**: `div.conversation-container`
- **User messages**: `user-query`, `div.query-text > p.query-text-line`
- **AI responses**: `model-response`, `message-content div.markdown`
- **Sidebar conversations**: `[data-test-id="conversation"]`

## 🔧 Step 2: Find New Selectors

### Using Browser Inspector
1. **Right-click** on a user message → "Inspect Element"
2. **Find the container** that wraps the message content
3. **Note the element structure**: tag name, classes, data attributes
4. **Repeat for AI responses** and other elements

### Example Investigation Process
```javascript
// Test potential selectors in console
document.querySelectorAll('div.conversation-container');  // 0 results = broken
document.querySelectorAll('div.chat-message-container');  // 5 results = new selector!

// Test user message selectors
document.querySelectorAll('user-query');                  // 0 results = broken
document.querySelectorAll('div.user-message');            // 3 results = new selector!
```

### Finding Conversation ID Pattern
```javascript
// Check sidebar conversation items
const items = document.querySelectorAll('[data-test-id="conversation"]');
items.forEach((item, i) => {
    console.log(`Item ${i}:`, [...item.attributes].map(a => `${a.name}="${a.value}"`));
});

// Look for conversation ID in current URL
console.log('Current URL:', window.location.href);
const currentId = window.location.href.split('/').pop();
console.log('Conversation ID:', currentId);
```

## 📝 Step 3: Update Configuration

### Create New Config Version
1. **Copy current working config**:
   ```bash
   cp selectors/gemini-selectors-v1.json selectors/gemini-selectors-v3.json
   ```

2. **Update metadata**:
   ```json
   {
     "version": "3.0.0",
     "description": "Updated selectors for Gemini interface changes - Dec 2025",
     "lastTested": "2025-12-01",
     "geminiVersion": "Updated interface"
   }
   ```

### Update Broken Selectors

**Example: Conversation containers changed**
```json
// Old (broken)
"conversation": {
  "containers": ["div.conversation-container"]
}

// New (working)
"conversation": {
  "containers": [
    "div.chat-message-container",     // New primary selector
    "div.conversation-container"      // Keep old as fallback
  ]
}
```

**Example: User message structure changed**
```json
// Old (broken)
"messages": {
  "userQuery": ["user-query"],
  "userText": ["div.query-text > p.query-text-line"]
}

// New (working)
"messages": {
  "userQuery": [
    "div.user-message",               // New primary
    "user-query"                      // Fallback
  ],
  "userText": [
    ".message-content p",             // New primary
    "div.query-text > p.query-text-line"  // Fallback
  ]
}
```

**Example: Conversation ID pattern changed**
```json
// Old (broken)
"title": {
  "conversationIdAttribute": "jslog",
  "conversationIdPattern": "\"c_{id}\""
}

// New (working)
"title": {
  "conversationIdAttribute": "data-conversation-id",
  "conversationIdAttributeFallback": "jslog",
  "conversationIdPattern": "\"{id}\"",
  "conversationIdPatternFallback": "\"c_{id}\""
}
```

## ✅ Step 4: Test New Configuration

### Test in Browser Console
```javascript
// Load and test new config manually
fetch(chrome.runtime.getURL('selectors/gemini-selectors-v3.json'))
  .then(r => r.json())
  .then(config => {
    // Test conversation containers
    const containers = document.querySelectorAll(config.selectors.conversation.containers[0]);
    console.log('Containers found:', containers.length);

    // Test user messages
    if (containers.length > 0) {
      const userQueries = containers[0].querySelectorAll(config.selectors.messages.userQuery[0]);
      console.log('User queries found:', userQueries.length);
    }
  });
```

### Reload Extension and Test
1. **Reload extension** in `chrome://extensions/`
2. **Navigate to Gemini** conversation page
3. **Run debug mode** again - should show found elements
4. **Try export** - should work with proper titles

## 📋 Step 5: Update Version Priority

The extension tries to load configs in this order:
1. `gemini-selectors-v2.json` (newest)
2. `gemini-selectors-v1.json` (fallback)

To make your new v3 config the default:

### Option A: Replace v2 (Recommended)
```bash
# Replace v2 with your working v3 config
mv selectors/gemini-selectors-v3.json selectors/gemini-selectors-v2.json
```

### Option B: Update content.js priority
```javascript
// In content.js, update the load order:
const configLoaded = await selectorConfig.loadConfig("v3") ||
                     await selectorConfig.loadConfig("v2") ||
                     await selectorConfig.loadConfig("v1");
```

## 🔄 Step 6: Share and Backup

### Backup Working Config
```bash
# Keep backup of working config
cp selectors/gemini-selectors-v2.json selectors/gemini-selectors-backup-working.json
```

### Share with Community
1. **Test thoroughly** on multiple conversations
2. **Document changes** made and why
3. **Share via GitHub** issue or PR
4. **Include test results** and screenshots if helpful

## 🛠️ Common Selector Patterns

### Finding Message Containers
```javascript
// Look for elements containing both user and AI messages
const allElements = document.querySelectorAll('*');
Array.from(allElements).filter(el => {
  const text = el.innerText;
  return text && text.includes('user_message_text') && text.includes('ai_response_text');
});
```

### Finding Sidebar Items
```javascript
// Look for clickable conversation items
document.querySelectorAll('div[role="button"]').forEach((el, i) => {
  const text = el.innerText?.trim();
  if (text && text.length > 10 && text.length < 100) {
    console.log(`Potential conversation ${i}:`, text);
  }
});
```

### Testing Conversation ID Extraction
```javascript
// Test if conversation items contain current page ID
const currentId = window.location.href.split('/').pop();
document.querySelectorAll('[data-test-id="conversation"]').forEach((item, i) => {
  const allAttrs = [...item.attributes].map(a => a.value).join(' ');
  if (allAttrs.includes(currentId)) {
    console.log(`Found current conversation in item ${i}:`, item.innerText);
  }
});
```

## 📚 Selector Best Practices

### Use Fallback Chains
```json
// Always provide fallbacks in order of reliability
"containers": [
  "div.new-conversation-wrapper",    // Most specific (try first)
  "div.conversation-container",      // Previous working
  "main[role='main']"                // Generic fallback
]
```

### Prefer Stable Attributes
```javascript
// More stable (less likely to change)
"[data-testid='conversation']"      // ✅ Semantic test IDs
"[role='button']"                   // ✅ Accessibility attributes

// Less stable (more likely to change)
".conversation-item-wrapper-v2"     // ❌ Version-specific classes
"div.ng-tns-c123456-789"           // ❌ Auto-generated classes
```

### Test Edge Cases
- **Empty conversations** (no messages)
- **Very long conversations** (virtual scrolling)
- **Code blocks and formatting** in messages
- **Different conversation types** (if Gemini has variants)

---

## 🆘 Need Help?

If you're stuck:

1. **Open GitHub issue** with:
   - Console logs from debug mode
   - Screenshots of Gemini interface
   - What you've tried so far

2. **Include test selectors** you found that might work

3. **Check if others** have reported similar issues

The configurable selector system makes updates much easier than before - you're just updating JSON, not rewriting code!
