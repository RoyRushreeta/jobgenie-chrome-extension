# JobGenie Chrome Extension

A Chrome extension that analyzes LinkedIn job postings and provides an AI-powered fit score based on your resume/profile.

## Features

- 🎯 **AI-Powered Analysis**: Uses Google's Gemini API for intelligent job-resume matching
- 📊 **Fit Score**: Get a 0-100% compatibility score for any LinkedIn job posting
- 📝 **Detailed Analysis**: Receive strengths, gaps, and recommendations
- 💾 **Secure Storage**: Your resume and API key are stored locally in Chrome
- 🔍 **Multiple LinkedIn Layouts**: Works with different LinkedIn job page designs

## Setup Instructions

### 1. Get a Gemini API Key
1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Create a new API key
3. Copy the API key for later use

### 2. Install the Extension
1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select the `jobgenie-extension` folder
5. The extension should now appear in your Chrome toolbar

### 3. Configure the Extension
1. Click the JobGenie extension icon in your toolbar
2. In the "Settings" section:
   - Paste your Gemini API key and click "Save"
   - Paste your resume/profile text and click "Save"

### 4. Use the Extension
1. Navigate to any LinkedIn job posting
2. Click the JobGenie extension icon
3. Click "Analyze Job" to get your fit score and detailed analysis

## How It Works

1. **Job Extraction**: The extension extracts job title, company, and description from LinkedIn
2. **AI Analysis**: Sends your resume and job details to Gemini API for analysis
3. **Smart Scoring**: Receives a detailed fit score with explanations
4. **Actionable Insights**: Get specific strengths, gaps, and recommendations

## Privacy & Security

- Your resume and API key are stored locally in Chrome (not on external servers)
- Job data is only sent to Google's Gemini API for analysis
- No data is collected or stored by the extension developers

## Troubleshooting

### Extension shows "No job details found"
- Make sure you're on a LinkedIn job posting page (URL should contain `/jobs/view/`)
- Try refreshing the LinkedIn page and clicking "Analyze Job" again
- LinkedIn sometimes updates their page structure - the extension includes multiple selectors to handle this

### API errors
- Verify your Gemini API key is correct
- Check that you have API quota remaining
- Ensure you have internet connectivity

### Missing fit score
- Ensure both API key and resume are saved in settings
- Check browser console for any error messages

## Development

To modify the extension:
1. Make changes to the source files
2. Go to `chrome://extensions/`
3. Click the refresh icon on the JobGenie extension
4. Test your changes

## File Structure

```
jobgenie-extension/
├── manifest.json       # Extension configuration
├── popup.html         # Extension popup UI
├── popup.js           # Main popup logic
├── content.js         # LinkedIn page interaction
├── background.js      # Background service worker
├── styles.css         # Popup styling
├── icon16.png         # Extension icon (16x16)
├── icon48.png         # Extension icon (48x48)
├── icon128.png        # Extension icon (128x128)
└── README.md          # This file
```

## Version History

- v1.0: Initial release with AI-powered job analysis
