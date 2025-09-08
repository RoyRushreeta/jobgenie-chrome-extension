// Background script for Job Genie Chrome Extension

// Context menu item ID
const CONTEXT_MENU_ID = 'analyze-job-genie';

// Create context menu when extension is installed
chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: CONTEXT_MENU_ID,
        title: 'Analyze Job with Job Genie',
        contexts: ['selection']
    });
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId === CONTEXT_MENU_ID && info.selectionText) {
        try {
            // Store the selected text
            await chrome.storage.local.set({
                'jobgenie_selected_text': info.selectionText.trim()
            });
            
            // Open the popup by clicking the extension action
            chrome.action.openPopup();
        } catch (error) {
            console.error('Error handling context menu click:', error);
        }
    }
});

// Handle messages from content script or popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'storeSelectedText') {
        // Store selected text from content script
        chrome.storage.local.set({
            'jobgenie_selected_text': request.text
        }).then(() => {
            sendResponse({ success: true });
        }).catch((error) => {
            console.error('Error storing selected text:', error);
            sendResponse({ success: false, error: error.message });
        });
        return true; // Keep the message channel open for async response
    }
    
    if (request.action === 'openPopup') {
        // Open popup programmatically
        chrome.action.openPopup();
        sendResponse({ success: true });
        return true;
    }
});

// Handle extension icon click
chrome.action.onClicked.addListener(async (tab) => {
    // This will be handled by the default popup
    // No additional action needed
});
