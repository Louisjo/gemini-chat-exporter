# Gemini Chat Exporter

**Forked from [Louisjo/gemini-chat-exporter](https://github.com/Louisjo/gemini-chat-exporter.git)**

A Chrome extension that allows you to export your Google Gemini chat conversations to JSON format for backup, analysis, or migration purposes.

## Features

- **Export Full Chat History**: Automatically scrolls to load complete conversation before export, ensuring all messages are captured.
- **Export All Chats**: Export current conversation plus sidebar chat history  
- **Robust Auto-Scroll Loading**: Enhanced logic for lazy-loaded content, with more aggressive scrolling and waiting mechanisms to capture full chat history reliably.
- **Accurate Message Extraction**: Improved message detection and extraction within the DOM to ensure all loaded messages are correctly captured.
- **JSON Format**: Clean, structured data that's easy to process, now including chat metadata and excluding redundant message timestamps.
- **Preserves Formatting**: Maintains code blocks and text structure
- **Privacy-First**: All processing happens locally in your browser
- **Enhanced Progress Feedback**: Real-time updates during long conversation loading, including a spinner and message count in the popup.
- **Customizable Filename**: Exported files now include date and time (HH-MM) in the filename for easier organization.
- **Error Handling**: Comprehensive feedback on success/failure

## Installation

### Method 1: Download and Install

1. **Download the extension:**
   - Clone this repository or download as ZIP
   - Extract to a folder (e.g., `gemini-chat-exporter`)

2. **Load in Chrome:**
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top right corner)
   - Click "Load unpacked"
   - Select the `gemini-chat-exporter` folder

3. **Pin the extension:**
   - Click the puzzle piece icon in Chrome toolbar
   - Find "Gemini Chat Exporter" and click the pin icon

## Usage

1. **Navigate to Gemini:**
   - Go to [gemini.google.com](https://gemini.google.com)
   - Open a chat conversation

2. **Export your chats:**
   - Click the Gemini Chat Exporter icon in your toolbar
   - Choose your export option:
     - **Export Full Chat History**: Automatically loads complete conversation via scrolling
     - **Export All Chats**: Downloads current chat + sidebar history
   - **Note**: Full history export may take 30-60 seconds for long conversations

3. **Access your data:**
   - Files download as JSON format
   - Filename includes the current date and time.
   - Open with any text editor or JSON viewer

## Export Format

The exported JSON includes:

```json
{
  "export_info": {
    "timestamp": "2024-01-20T10:30:00.000Z",
    "source": "Gemini Chat Exporter v1.1.2",
    "total_chats": 1,
    "total_messages": 10
  },  "chats": [
    {
      "id": "current-chat-1234567890",
      "title": "Chat about JavaScript",
      "timestamp": "2024-01-20T10:30:00.000Z",
      "url": "https://gemini.google.com/chat/...",
      "messageCount": 10,
      "messages": [
        {
          "role": "user",
          "content": "How do I create a Chrome extension?",
          "word_count": 7
        },
        {
          "role": "assistant", 
          "content": "To create a Chrome extension...",
          "word_count": 150
        }
      ]
    }
  ]
}
```

## File Structure

```
gemini-chat-exporter/
├── manifest.json          # Extension configuration
├── popup.html            # Extension popup interface
├── popup.js              # Popup functionality
├── content.js            # Main extraction logic
├── README.md             # This file
├── LICENSE               # MIT License
└── .gitignore           # Git ignore rules
```

## Technical Details

- **Manifest Version**: 3 (latest Chrome extension standard)
- **Permissions**: `activeTab`, `storage`
- **Host Permissions**: `https://gemini.google.com/*`
- **Content Script**: Runs on Gemini pages to extract chat data
- **Popup Interface**: Provides user controls and status feedback

## Browser Compatibility

- ✅ Google Chrome (Recommended)
- ✅ Microsoft Edge (Chromium-based)
- ✅ Brave Browser
- ✅ Other Chromium-based browsers
- ❌ Firefox (uses different extension format)
- ❌ Safari (uses different extension format)

## Privacy & Security

- **Local Processing**: All chat extraction happens in your browser
- **No Data Collection**: Extension doesn't send data to external servers- **No Analytics**: No tracking or usage statistics collected
- **Open Source**: Full source code available for review

## Troubleshooting

### Extension Not Working?
1. Ensure you're on `gemini.google.com`
2. Refresh the page after installing the extension
3. Check Chrome DevTools Console (F12) for errors

### No Messages Found?
1. Scroll through the chat to load all messages
2. Try refreshing the page and reopening the chat
3. Google may have updated their interface - please file an issue

### File Download Issues?
1. Check Chrome's download settings
2. Ensure pop-ups are allowed for the extension
3. Try right-clicking and "Save As" if auto-download fails

### Export Errors?
1. Wait for the page to fully load before exporting
2. Try exporting current chat first, then all chats
3. Large chat histories may take longer to process

## Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Disclaimer

This extension is not affiliated with Google or the Gemini AI service. It's an independent tool created to help users export their own chat data.

## Changelog

### v1.1.2
- **Refactor & Bug Fixes**: Comprehensive update to enhance reliability and user experience. This includes:
  - Corrected `popup.js` event listener initialization.
  - Improved auto-scroll logic in `content.js` to ensure full conversation loading (alternating scroll up/down, increased delays).
  - Enhanced message extraction in `content.js` to correctly capture all visible messages from the DOM.
  - Added a spinner and message count to the export progress display in `popup.js`.
  - Included `HH-MM` timestamp in the exported filename.
  - Restored complete JSON export structure with `export_info` and chat metadata.
  - Removed redundant `timestamp` field from individual messages in the exported JSON.
  - Localized all debug and console messages to English for consistency.

### v1.1.1
- **Bug Fix**: Improved full chat history export for long conversations. Enhanced auto-scroll logic to ensure all messages are loaded and extracted, addressing issues where only visible content was captured. Added more robust message detection and extraction within the DOM.

### v1.1.0
- **Major Feature: Full Chat History Export**
- Auto-scroll functionality to load complete conversations
- Handles lazy-loaded content and infinite scroll
- Progress feedback during long conversation loading
- Updated UI with better user guidance
- Improved error handling for scroll operations

### v1.0.4
- Clean formatting and duplicate removal
- Prevent duplicate user text extraction
- Improved assistant response formatting
- Remove markdown bold markers
- Better text cleanup and formatting

### v1.0.3
- Fixed extraction based on debug analysis
- Proper separation of user queries and model responses
- Correct extraction using USER-QUERY and MODEL-RESPONSE elements

### v1.0.2
- Enhanced DOM selectors for current Gemini interface
- Better message detection with fallback patterns
- Improved content extraction and role detection

### v1.0.1
- Initial release
- Export current chat functionality
- Export all chats functionality
- JSON format with metadata
- Error handling and user feedback

## Support

If you find this extension helpful, please:
- ⭐ Star this repository
- 🐛 Report bugs via GitHub Issues
- 💡 Suggest features via GitHub Issues
- 🤝 Contribute code via Pull Requests

---

**Note**: Google may update the Gemini interface, which could require updates to the extension. We'll do our best to keep it compatible with the latest version.