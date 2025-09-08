// DOM Elements
const apiKeyInput = document.getElementById('api-key');
const saveApiKeyBtn = document.getElementById('save-api-key');
const changeApiKeyBtn = document.getElementById('change-api-key');
const apiKeyMessage = document.getElementById('api-key-message');
const resumeInput = document.getElementById('resume-input');
const saveResumeBtn = document.getElementById('save-resume');
const resumeStatus = document.getElementById('resume-status');
const jobInput = document.getElementById('job-input');
const analyzeJobBtn = document.getElementById('analyze-job');
const saveResultsBtn = document.getElementById('save-results');
const newAnalysisBtn = document.getElementById('new-analysis');
const retryAnalysisBtn = document.getElementById('retry-analysis');

// Sections
const apiKeySection = document.getElementById('api-key-section');
const apiKeyManagement = document.getElementById('api-key-management');
const resumeSection = document.getElementById('resume-section');
const jobSection = document.getElementById('job-section');
const loadingSection = document.getElementById('loading-section');
const resultsSection = document.getElementById('results-section');
const errorSection = document.getElementById('error-section');

// Result elements
const matchPercentage = document.getElementById('match-percentage');
const strengthsList = document.getElementById('strengths-list');
const gapsList = document.getElementById('gaps-list');
const improvementsList = document.getElementById('improvements-list');
const questionsList = document.getElementById('questions-list');
const errorMessage = document.getElementById('error-message');

// Storage keys
const STORAGE_KEYS = {
    API_KEY: 'jobgenie_api_key',
    RESUME: 'jobgenie_resume',
    SELECTED_TEXT: 'jobgenie_selected_text'
};

// Global variables
let currentAnalysis = null;

// Initialize popup
document.addEventListener('DOMContentLoaded', initializePopup);

async function initializePopup() {
    try {
        // Load saved data
        const result = await chrome.storage.local.get([
            STORAGE_KEYS.API_KEY,
            STORAGE_KEYS.RESUME,
            STORAGE_KEYS.SELECTED_TEXT
        ]);

        // Load API key and set appropriate UI state
        if (result[STORAGE_KEYS.API_KEY]) {
            apiKeyInput.value = result[STORAGE_KEYS.API_KEY];
            showApiKeyManagement();
        } else {
            showApiKeyInput();
        }

        // Load saved resume
        if (result[STORAGE_KEYS.RESUME]) {
            resumeInput.value = result[STORAGE_KEYS.RESUME];
            showResumeStatus('Resume loaded successfully!', 'success');
        }

        // Load selected text if available
        if (result[STORAGE_KEYS.SELECTED_TEXT]) {
            jobInput.value = result[STORAGE_KEYS.SELECTED_TEXT];
            // Clear the selected text after loading
            chrome.storage.local.remove(STORAGE_KEYS.SELECTED_TEXT);
        }

        // Update UI state
        updateUIState();
    } catch (error) {
        console.error('Error initializing popup:', error);
    }
}

// Event listeners
saveApiKeyBtn.addEventListener('click', saveApiKey);
changeApiKeyBtn.addEventListener('click', showApiKeyInput);
saveResumeBtn.addEventListener('click', saveResume);
analyzeJobBtn.addEventListener('click', analyzeJob);
saveResultsBtn.addEventListener('click', saveResults);
newAnalysisBtn.addEventListener('click', resetToInput);
retryAnalysisBtn.addEventListener('click', analyzeJob);

// API Key functions
async function saveApiKey() {
    const apiKey = apiKeyInput.value.trim();
    if (!apiKey) {
        showApiKeyMessage('Please enter a valid API key', 'error');
        return;
    }

    try {
        await chrome.storage.local.set({ [STORAGE_KEYS.API_KEY]: apiKey });
        showApiKeyManagement();
        showApiKeyMessage('✅ API key saved successfully!', 'success');
        updateUIState();
    } catch (error) {
        console.error('Error saving API key:', error);
        showApiKeyMessage('Error saving API key', 'error');
    }
}

function showApiKeyInput() {
    hideSection(apiKeyManagement);
    showSection(apiKeySection);
    apiKeyInput.value = ''; // Clear the input for new key
    hideApiKeyMessage();
}

function showApiKeyManagement() {
    hideSection(apiKeySection);
    showSection(apiKeyManagement);
    hideApiKeyMessage();
}

function showApiKeyMessage(message, type) {
    apiKeyMessage.textContent = message;
    apiKeyMessage.className = `status ${type}`;
    showSection(apiKeyMessage);
    
    // Auto-hide success messages after 3 seconds
    if (type === 'success') {
        setTimeout(() => {
            hideApiKeyMessage();
        }, 3000);
    }
}

function hideApiKeyMessage() {
    hideSection(apiKeyMessage);
}

// Resume functions
async function saveResume() {
    const resume = resumeInput.value.trim();
    if (!resume) {
        showResumeStatus('Please enter your resume content', 'error');
        return;
    }

    try {
        await chrome.storage.local.set({ [STORAGE_KEYS.RESUME]: resume });
        showResumeStatus('Resume saved successfully!', 'success');
        updateUIState();
    } catch (error) {
        console.error('Error saving resume:', error);
        showResumeStatus('Error saving resume', 'error');
    }
}

function showResumeStatus(message, type) {
    resumeStatus.textContent = message;
    resumeStatus.className = `status ${type}`;
    resumeStatus.style.display = 'block';
}

// Job analysis functions
async function analyzeJob() {
    const jobDescription = jobInput.value.trim();
    const resume = resumeInput.value.trim();
    const apiKey = apiKeyInput.value.trim();

    // Validation
    if (!apiKey) {
        showError('Please set your Gemini API key first');
        showApiKeyInput();
        return;
    }

    if (!resume) {
        showError('Please add your resume first');
        return;
    }

    if (!jobDescription) {
        showError('Please add a job description to analyze');
        return;
    }

    // Show loading
    hideAllSections();
    showSection(loadingSection);

    try {
        const analysis = await callGeminiAPI(apiKey, jobDescription, resume);
        currentAnalysis = analysis; // Store for saving
        displayResults(analysis);
    } catch (error) {
        console.error('Error analyzing job:', error);
        showError(error.message || 'Failed to analyze job. Please check your API key and try again.');
    }
}

async function callGeminiAPI(apiKey, jobDescription, resume) {
    const prompt = `You are an expert career advisor and recruiter. Analyze this job description against the provided resume and provide a comprehensive assessment.

Job Description:
${jobDescription}

Resume:
${resume}

ANALYSIS REQUIREMENTS:
1. Calculate a realistic match percentage (0-100) based on skills, experience, and qualifications alignment
2. Identify key strengths - focus on what makes this candidate stand out for THIS specific role
3. Identify skill gaps - what's missing or could be stronger for THIS specific role
4. Provide practical resume improvements - specific, actionable recommendations to better match this JD
5. Generate targeted interview questions - based on the actual skills and requirements mentioned in the JD

FORMATTING RULES:
- Strengths & Gaps: Keep each point concise, one-line summaries (max 10-12 words)
- Resume Improvements: Practical, specific recommendations (3-5 items)
- Interview Questions: Skill-specific questions tied to JD requirements (3-5 items)
- Avoid generic advice - tailor everything to this specific job description

Return ONLY a valid JSON response in this exact format:
{
  "match_percentage": number (0-100),
  "strengths": ["concise strength 1", "concise strength 2", "concise strength 3"],
  "gaps": ["concise gap 1", "concise gap 2", "concise gap 3"],
  "resume_improvements": ["specific improvement 1", "specific improvement 2", "specific improvement 3"],
  "interview_questions": ["skill-specific question 1", "skill-specific question 2", "skill-specific question 3"]
}

Important: Return only the JSON object, no additional text, explanations, or formatting.`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            contents: [{
                parts: [{
                    text: prompt
                }]
            }]
        })
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `API request failed with status ${response.status}`);
    }

    const data = await response.json();
    
    if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
        throw new Error('Invalid API response format');
    }

    const text = data.candidates[0].content.parts[0].text;
    
    try {
        // Clean the response text to extract JSON
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error('No JSON found in response');
        }
        
        const analysis = JSON.parse(jsonMatch[0]);
        
        // Validate the response structure
        if (typeof analysis.match_percentage !== 'number' ||
            !Array.isArray(analysis.strengths) ||
            !Array.isArray(analysis.gaps) ||
            !Array.isArray(analysis.resume_improvements) ||
            !Array.isArray(analysis.interview_questions)) {
            throw new Error('Invalid response structure');
        }
        
        return analysis;
    } catch (parseError) {
        console.error('Error parsing API response:', parseError);
        console.error('Raw response:', text);
        throw new Error('Failed to parse AI response. Please try again.');
    }
}

function displayResults(analysis) {
    // Update match percentage
    matchPercentage.textContent = `${Math.round(analysis.match_percentage)}%`;
    
    // Update strengths
    strengthsList.innerHTML = '';
    analysis.strengths.forEach(strength => {
        const li = document.createElement('li');
        li.textContent = strength;
        strengthsList.appendChild(li);
    });
    
    // Update gaps
    gapsList.innerHTML = '';
    analysis.gaps.forEach(gap => {
        const li = document.createElement('li');
        li.textContent = gap;
        gapsList.appendChild(li);
    });
    
    // Update resume improvements
    improvementsList.innerHTML = '';
    analysis.resume_improvements.forEach(improvement => {
        const li = document.createElement('li');
        li.textContent = improvement;
        improvementsList.appendChild(li);
    });
    
    // Update interview questions
    questionsList.innerHTML = '';
    analysis.interview_questions.forEach(question => {
        const li = document.createElement('li');
        li.textContent = question;
        questionsList.appendChild(li);
    });
    
    // Show results
    hideAllSections();
    showSection(resultsSection);
}

// Save Results Functions
async function saveResults() {
    if (!currentAnalysis) {
        alert('No analysis results to save');
        return;
    }

    try {
        const filename = `jobgenie_analysis_${Date.now()}.txt`;
        const content = generateFileContent(currentAnalysis);
        
        // Create blob and download
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        
        await chrome.downloads.download({
            url: url,
            filename: filename,
            saveAs: false
        });
        
        // Clean up the blob URL
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        
        // Show success message briefly
        const originalText = saveResultsBtn.textContent;
        saveResultsBtn.textContent = '✅ Saved!';
        saveResultsBtn.disabled = true;
        
        setTimeout(() => {
            saveResultsBtn.textContent = originalText;
            saveResultsBtn.disabled = false;
        }, 2000);
        
    } catch (error) {
        console.error('Error saving results:', error);
        alert('Failed to save results. Please try again.');
    }
}

function generateFileContent(analysis) {
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 19).replace('T', ' ');
    
    let content = `Job Genie Analysis – ${dateStr}\n\n`;
    
    // Add strengths
    content += '💪 Strengths:\n';
    analysis.strengths.forEach(strength => {
        content += `- ${strength}\n`;
    });
    content += '\n';
    
    // Add gaps
    content += '⚠️ Gaps:\n';
    analysis.gaps.forEach(gap => {
        content += `- ${gap}\n`;
    });
    content += '\n';
    
    // Add resume improvements
    content += '📝 Resume Improvements:\n';
    analysis.resume_improvements.forEach(improvement => {
        content += `- ${improvement}\n`;
    });
    content += '\n';
    
    // Add interview questions
    content += '🎤 Interview Questions:\n';
    analysis.interview_questions.forEach(question => {
        content += `- ${question}\n`;
    });
    content += '\n';
    
    return content;
}

function showError(message) {
    errorMessage.textContent = message;
    hideAllSections();
    showSection(errorSection);
}

function resetToInput() {
    hideAllSections();
    
    // Show appropriate API key section based on whether key exists
    if (apiKeyInput.value.trim()) {
        showApiKeyManagement();
    } else {
        showApiKeyInput();
    }
    
    // Always show resume and job sections
    showSection(resumeSection);
    showSection(jobSection);
    
    updateUIState();
}

// UI Helper functions
function updateUIState() {
    const hasApiKey = apiKeyInput.value.trim();
    const hasResume = resumeInput.value.trim();
    
    // Show appropriate sections based on state
    showSection(resumeSection);
    showSection(jobSection);
    
    // Enable/disable analyze button
    analyzeJobBtn.disabled = !hasApiKey || !hasResume || !jobInput.value.trim();
}

function hideAllSections() {
    [apiKeySection, apiKeyManagement, resumeSection, jobSection, loadingSection, resultsSection, errorSection]
        .forEach(section => hideSection(section));
}

function showSection(section) {
    section.classList.remove('hidden');
}

function hideSection(section) {
    section.classList.add('hidden');
}

// Listen for input changes to update UI state
apiKeyInput.addEventListener('input', updateUIState);
resumeInput.addEventListener('input', updateUIState);
jobInput.addEventListener('input', updateUIState);
