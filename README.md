# Gemini Chat Exporter v1.2.0

A Chrome extension that exports your Google Gemini chat conversations to JSON format, featuring **configurable selectors** for future-proof maintenance.

## 🚀 Features

- **Export current conversation** to a named JSON file
- **Export all conversations** including chat history
- **Configurable selectors** - no code changes needed when Gemini updates their interface
- **Proper conversation titles** extracted from sidebar (not just tab titles)
- **Progress feedback** with real-time status updates
- **Timeout protection** prevents infinite hangs
- **Debug functionality** for troubleshooting DOM changes

## 📁 Project Structure

```
gemini-chat-exporter/
├── manifest.json                     # Extension configuration
├── popup.html                        # Extension popup UI
├── popup.js                          # Popup logic and messaging
├── content.js                        # Main extraction logic with configurable selectors
└── selectors/                        # 🆕 Configurable selector system
    ├── gemini-selectors-v1.json      # Current working selectors (June 2025)
    └── gemini-selectors-v2.json      # Future interface support
```

## 🔧 Installation

1. Clone or download this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" in the top-right corner
4. Click "Load unpacked" and select the `gemini-chat-exporter` folder
5. Navigate to [gemini.google.com](https://gemini.google.com)
6. Click the extension icon to export chats

## 🎯 Usage

### Export Current Conversation
1. Navigate to the Gemini conversation you want to export
2. Click the extension icon
3. Click "Export Current Chat"
4. File will download as: `Conversation_Title-YYYY-MM-DD_HH-MM.json`

### Export All Conversations
1. From any Gemini page with chat history visible
2. Click "Export All Chats"
3. Exports both current conversation and sidebar history

### Debug Mode
- Click "Debug DOM Structure" to analyze page elements
- Check browser console (F12) for detailed selector information
- Useful for troubleshooting when Gemini interface changes

## 🔄 Configurable Selector System

### Why Configurable Selectors?

Web applications like Gemini frequently change their HTML structure, breaking traditional web scrapers. This extension uses a **configurable selector system** that allows updates without code changes.

### How It Works

1. **Selector configurations** are stored in JSON files (`selectors/`)
2. **Extension loads** the newest compatible configuration automatically
3. **When Gemini updates** their interface, only the JSON config needs updating
4. **Fallback system** ensures extension keeps working during transitions

### Selector Configuration Structure

```json
{
  "version": "1.0.0",
  "description": "Gemini interface selectors - working as of June 2025",
  "selectors": {
    "conversation": {
      "containers": ["div.conversation-container"],
      "sidebarItems": ["[data-test-id=\"conversation\"]"]
    },
    "messages": {
      "userQuery": ["user-query"],
      "userText": ["div.query-text > p.query-text-line"],
      "modelResponse": ["model-response"],
      "modelContent": ["message-content div.markdown"]
    },
    "title": {
      "conversationIdAttribute": "jslog",
      "conversationIdPattern": "\"c_{id}\""
    }
  }
}
```

### Updating Selectors When Gemini Changes

When the extension stops working due to Gemini interface changes:

1. **Identify broken selectors** using debug mode
2. **Update JSON configuration** with new selectors
3. **Test with new config** - no code compilation needed
4. **Share updated config** with other users

### Version Management

- **v1**: Current working selectors (June 2025)
- **v2**: Future interface compatibility
- **Automatic fallback**: Tries newest version, falls back to v1 if needed

## 📊 Export Format

### JSON Structure
```json
{
  "export_info": {
    "timestamp": "2025-06-03T14:30:00.000Z",
    "source": "Gemini Chat Exporter v1.2.0",
    "selectorConfig": {
      "version": "1.0.0",
      "description": "Working selectors"
    },
    "total_chats": 1,
    "total_messages": 10
  },
  "chats": [
    {
      "id": "current-chat-1717423800000",
      "title": "Chrome Extension Development Help",
      "timestamp": "2025-06-03T14:30:00.000Z",
      "url": "https://gemini.google.com/app/abc123",
      "messageCount": 10,
      "messages": [
        {
          "role": "user",
          "content": "Help me debug this Chrome extension...",
          "timestamp": "2025-06-03T14:30:00.000Z",
          "word_count": 8
        },
        {
          "role": "assistant",
          "content": "I'd be happy to help you debug...",
          "timestamp": "2025-06-03T14:30:01.000Z",
          "word_count": 125
        }
      ],
      "extractedWith": {
        "selectorVersion": "1.0.0",
        "selectorDescription": "Working June 2025 selectors"
      }
    }
  ]
}
```

## 🛠️ Development & Maintenance

### For Developers

The configurable selector system makes maintenance much easier:

```javascript
// Old way - hardcoded selectors (breaks when Gemini updates)
const containers = document.querySelectorAll('div.conversation-container');

// New way - configurable selectors (adapts to changes)
const containers = config.querySelector('conversation', 'containers');
```

### Contributing Selector Updates

1. **Test new selectors** in browser console
2. **Update appropriate JSON config** file
3. **Submit PR** or share config file
4. **No code knowledge required** - just CSS selector familiarity

### Creating New Selector Configurations

1. Copy existing config file (e.g., `v1.json` → `v3.json`)
2. Update `version`, `description`, and `lastTested` fields
3. Modify selectors for new Gemini interface
4. Test thoroughly before sharing

## 🔍 Troubleshooting

### Extension Not Working?

1. **Check console logs** (F12) for error messages
2. **Run debug mode** to see current DOM structure
3. **Verify Gemini interface** hasn't changed significantly
4. **Try reloading** the extension or Gemini page

### No Messages Extracted?

- **Manually scroll** through conversation first (loads virtual content)
- **Check selector configuration** - may need updating for new interface
- **Use debug mode** to identify current DOM structure

### Wrong Conversation Title?

- **Ensure conversation is visible** in sidebar
- **Check if conversation ID pattern** has changed
- **Update title extraction selectors** in configuration

## 📝 Token-Efficient Development

This extension was designed with **AI-assisted development** in mind:

- **File-based editing** instead of large code artifacts
- **Modular configuration** allows targeted updates
- **Clear separation** between logic and selectors
- **Comprehensive logging** for easy debugging

## 🤝 Contributing

Contributions welcome! Especially:

- **Updated selector configurations** for new Gemini interfaces
- **Bug reports** with console logs and debug output
- **Feature requests** for additional export formats
- **Documentation improvements**

## 📄 License

MIT License - see LICENSE file for details.

## 🏷️ Version History

### v1.2.0 (Current)
- ✅ **Configurable selector system** - future-proof maintenance
- ✅ **Proper conversation title extraction** from sidebar
- ✅ **Enhanced error handling** and timeout protection
- ✅ **Debug functionality** for troubleshooting
- ✅ **Progress feedback** during export process

### v1.1.4 (Previous)
- ✅ **Working title extraction** using URL matching
- ✅ **Optimized scrolling** with shorter timeouts
- ✅ **Message progress updates** in popup

### v1.0.0 (Original)
- ✅ **Basic chat export** functionality
- ✅ **Current and all chat export** options
- ✅ **JSON format** output

---

**Made with 🤖 AI-assisted development** - demonstrating token-efficient collaboration between human and AI for maintainable software architecture.
