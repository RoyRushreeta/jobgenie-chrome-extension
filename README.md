# 🧞‍♂️ Job Genie - Chrome Extension

**Analyze job descriptions against your resume using AI. Get match %, strengths, gaps, resume improvements, and targeted interview questions instantly.**

## ✨ Features

- **🎯 Smart Job Analysis**: Compare any job description with your resume using Google's Gemini AI
- **📊 Comprehensive Insights**: Get match percentage, key strengths, skill gaps, resume improvements, and targeted interview questions
- **🖱️ Easy Text Selection**: Right-click on highlighted job descriptions or use keyboard shortcuts
- **💾 Resume Storage**: Save your resume once and reuse it for multiple analyses
- **🔐 Secure API Key Storage**: Your Gemini API key is stored securely in your browser with easy update option
- **💾 Save Results**: Export analysis results to organized .txt files with smart naming
- **🎨 Clean UI**: Modern, intuitive popup interface

## 🚀 Installation

### Method 1: Load as Unpacked Extension (Development)

1. **Download/Clone** this repository to your local machine
2. **Generate Icons** (required):
   - Open `icon-generator.html` in your browser
   - Follow the instructions to create the required icon files
   - Save them in the `icons/` folder as PNG files (16x16, 32x32, 48x48, 128x128)
3. **Open Chrome** and navigate to `chrome://extensions/`
4. **Enable Developer Mode** (toggle in the top-right corner)
5. **Click "Load unpacked"** and select this extension folder
6. **Pin the extension** to your toolbar for easy access

### Method 2: Create Icons Quickly

If you don't want to create custom icons, you can use any 16x16, 32x32, 48x48, and 128x128 PNG images as placeholders:

1. Find or create simple square images in those sizes
2. Name them `icon16.png`, `icon32.png`, `icon48.png`, `icon128.png`
3. Place them in the `icons/` folder

## 🔧 Setup

### 1. Get Gemini API Key

1. Visit [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Sign in with your Google account
3. Create a new API key
4. Copy the API key

### 2. Configure Extension

1. **Click the Job Genie extension icon** in your Chrome toolbar
2. **Enter your Gemini API key** in the popup and click "Save"
3. **Add your resume** by pasting it in the text area and clicking "Save Resume"

### 3. Update API Key (Optional)

- **Change API Key**: After saving your initial API key, you can update it anytime by clicking "⚙️ Change API Key"
- **New Key Entry**: Enter your new API key and save - the old key will be replaced
- **No Restart Required**: The extension will work immediately with the new key

## 📖 Usage

### Method 1: Context Menu (Right-Click)

1. **Navigate to any job posting** (LinkedIn, Indeed, company websites, etc.)
2. **Highlight the job description text**
3. **Right-click** and select **"Analyze Job with Job Genie"**
4. The extension popup will open with the job description pre-filled
5. **Click "🔍 Analyze Job Match"** to get AI-powered insights

### Method 2: Manual Input

1. **Click the Job Genie extension icon**
2. **Copy and paste** a job description into the text area
3. **Click "🔍 Analyze Job Match"**

### Method 3: Keyboard Shortcut

1. **Select job description text** on any webpage
2. **Press Ctrl+Shift+J** (Windows) or **Cmd+Shift+J** (Mac)
3. **Click the extension icon** to open the popup and analyze

### Saving Results

1. **After analysis completes**, click the **"💾 Save Results"** button
2. **Consistent file naming**: Files are saved as `jobgenie_analysis_timestamp.txt`
3. **Example filename**: `jobgenie_analysis_1694178123456.txt`
4. **Content**: Saved file includes strengths, gaps, resume improvements, and interview questions (excludes job description and resume for privacy)

## 📊 Analysis Results

The AI analysis provides:

- **🎯 Match Percentage**: How well your resume matches the job (0-100%)
- **💪 Key Strengths**: What makes you a strong candidate for this specific role
- **⚠️ Skill Gaps**: Areas where you might need improvement for this position
- **📝 Resume Improvements**: Practical, actionable recommendations to better match this job
- **🎤 Interview Questions**: Targeted questions based on the actual job requirements
- **💾 Save Results**: Export your analysis to a .txt file for future reference

## 🛠️ Technical Details

### Files Structure

```
job-genie-extension/
├── manifest.json          # Extension configuration
├── popup.html             # Main popup interface
├── popup.css              # Styling for popup
├── popup.js               # Popup functionality
├── background.js          # Background script for context menus
├── content.js             # Content script for text selection
├── icon-generator.html    # Tool to generate icons
├── icons/                 # Extension icons
│   ├── icon16.png
│   ├── icon32.png
│   ├── icon48.png
│   └── icon128.png
└── README.md              # This file
```

### API Integration

- **API Provider**: Google Gemini 1.5 Flash
- **Endpoint**: `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent`
- **Storage**: Chrome Extension Storage API (local)
- **Security**: API keys stored locally, never transmitted to third parties

### Permissions

- `storage`: For saving resume and API key
- `contextMenus`: For right-click menu integration
- `activeTab`: For reading selected text
- `scripting`: For content script injection
- `downloads`: For saving analysis results to files

## 🔒 Privacy & Security

- **Local Storage Only**: Your resume and API key are stored locally in your browser
- **No Data Collection**: We don't collect, store, or transmit your personal data
- **Direct API Calls**: Communications go directly to Google's Gemini API
- **Open Source**: All code is visible and auditable

## 🐛 Troubleshooting

### Common Issues

1. **"Please set your Gemini API key"**
   - Make sure you've entered a valid API key from Google AI Studio
   - Check if the API key has proper permissions

2. **"Failed to analyze job"**
   - Verify your internet connection
   - Check if the API key is correct and hasn't expired
   - Ensure the job description text is substantial (not just a title)

3. **Context menu not appearing**
   - Make sure you've selected text before right-clicking
   - Try refreshing the webpage and selecting text again

4. **Extension icon not visible**
   - Make sure you've pinned the extension to your toolbar
   - Check if the extension is enabled in chrome://extensions/

### Debug Mode

1. Open Chrome DevTools (F12)
2. Go to the Console tab
3. Look for any error messages from "Job Genie"

## 🔄 Updates

To update the extension:

1. Pull the latest changes from the repository
2. Go to `chrome://extensions/`
3. Click the refresh button on the Job Genie extension card

## 📄 License

This project is open source and available under the MIT License.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit issues and pull requests.

## 💡 Tips for Best Results

1. **Select comprehensive job descriptions** - Include requirements, responsibilities, and qualifications
2. **Keep your resume updated** - Update your saved resume as you gain new skills
3. **Use for multiple positions** - Compare different roles to see which matches your profile best
4. **Review the gaps** - Use the identified skill gaps to guide your learning and development

---

**Happy job hunting with Job Genie! 🧞‍♂️✨**
