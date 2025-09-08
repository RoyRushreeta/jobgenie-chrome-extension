// Content script for Job Genie Chrome Extension
// Runs on all web pages to enhance text selection functionality

(function() {
    'use strict';
    
    // Function to get selected text
    function getSelectedText() {
        const selection = window.getSelection();
        return selection.toString().trim();
    }
    
    // Function to send selected text to background script
    async function sendSelectedText(text) {
        try {
            const response = await chrome.runtime.sendMessage({
                action: 'storeSelectedText',
                text: text
            });
            return response;
        } catch (error) {
            console.error('Error sending selected text:', error);
            return { success: false, error: error.message };
        }
    }
    
    // Enhanced selection handler for double-click or keyboard shortcuts
    let lastSelectedText = '';
    
    // Listen for selection changes
    document.addEventListener('selectionchange', () => {
        const selectedText = getSelectedText();
        if (selectedText && selectedText.length > 20) { // Only for substantial text
            lastSelectedText = selectedText;
        }
    });
    
    // Listen for keyboard shortcuts (Ctrl+Shift+J for Job Genie)
    document.addEventListener('keydown', async (event) => {
        if (event.ctrlKey && event.shiftKey && event.key === 'J') {
            event.preventDefault();
            
            const selectedText = getSelectedText() || lastSelectedText;
            if (selectedText && selectedText.length > 20) {
                // Store the selected text
                const result = await sendSelectedText(selectedText);
                if (result.success) {
                    // Show a brief notification
                    showNotification('Job description captured! Click the Job Genie extension to analyze.');
                }
            } else {
                showNotification('Please select some text first (job description).');
            }
        }
    });
    
    // Function to show a brief notification
    function showNotification(message) {
        // Remove existing notification if any
        const existingNotification = document.getElementById('jobgenie-notification');
        if (existingNotification) {
            existingNotification.remove();
        }
        
        // Create notification element
        const notification = document.createElement('div');
        notification.id = 'jobgenie-notification';
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            z-index: 10000;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 14px;
            font-weight: 500;
            max-width: 300px;
            animation: slideIn 0.3s ease-out;
        `;
        
        // Add animation styles
        if (!document.getElementById('jobgenie-styles')) {
            const styles = document.createElement('style');
            styles.id = 'jobgenie-styles';
            styles.textContent = `
                @keyframes slideIn {
                    from {
                        transform: translateX(100%);
                        opacity: 0;
                    }
                    to {
                        transform: translateX(0);
                        opacity: 1;
                    }
                }
                @keyframes slideOut {
                    from {
                        transform: translateX(0);
                        opacity: 1;
                    }
                    to {
                        transform: translateX(100%);
                        opacity: 0;
                    }
                }
            `;
            document.head.appendChild(styles);
        }
        
        notification.textContent = message;
        document.body.appendChild(notification);
        
        // Auto-remove after 3 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.style.animation = 'slideOut 0.3s ease-in';
                setTimeout(() => {
                    if (notification.parentNode) {
                        notification.remove();
                    }
                }, 300);
            }
        }, 3000);
    }
    
    // Auto-detect job description patterns and suggest analysis
    function detectJobDescription() {
        const text = document.body.innerText.toLowerCase();
        const jobKeywords = [
            'job description', 'responsibilities', 'requirements', 'qualifications',
            'experience required', 'skills required', 'job summary', 'role summary',
            'position summary', 'what you\'ll do', 'what we\'re looking for',
            'minimum qualifications', 'preferred qualifications'
        ];
        
        const hasJobKeywords = jobKeywords.some(keyword => text.includes(keyword));
        const isJobSite = /indeed|linkedin|glassdoor|monster|ziprecruiter|careerbuilder/i.test(window.location.hostname);
        
        return hasJobKeywords || isJobSite;
    }
    
    // Show helper hint on job sites
    if (detectJobDescription()) {
        setTimeout(() => {
            const selectedText = getSelectedText();
            if (!selectedText) {
                showNotification('💡 Tip: Select job description text and use Ctrl+Shift+J or right-click to analyze with Job Genie!');
            }
        }, 2000);
    }
    
    // Listen for messages from popup or background script
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'getSelectedText') {
            const selectedText = getSelectedText();
            sendResponse({ text: selectedText });
        }
        return true;
    });
    
    console.log('Job Genie content script loaded');
})();
