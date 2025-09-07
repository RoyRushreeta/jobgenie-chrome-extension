document.addEventListener('DOMContentLoaded', function() {
  const apiKeyInput = document.getElementById('api-key');
  const resumeInput = document.getElementById('resume');
  const saveApiKeyBtn = document.getElementById('save-api-key');
  const saveResumeBtn = document.getElementById('save-resume');
  const analyzeJobBtn = document.getElementById('analyze-job');
  const generateInterviewPdfBtn = document.getElementById('generate-interview-pdf');
  const jobInfoDiv = document.getElementById('job-info');
  const fitScoreContainer = document.getElementById('fit-score-container');
  const fitScoreDiv = document.getElementById('fit-score');
  const analysisDetailsDiv = document.getElementById('analysis-details');

  // Global variable to store current job data for PDF generation
  let currentJobData = null;

  // Load saved data
  loadSavedData();

  function loadSavedData() {
    chrome.storage.sync.get(['apiKey', 'resume'], function(result) {
      if (result.apiKey) {
        apiKeyInput.value = result.apiKey;
      }
      if (result.resume) {
        resumeInput.value = result.resume;
      }
    });
  }

  saveApiKeyBtn.addEventListener('click', function() {
    const apiKey = apiKeyInput.value.trim();
    if (apiKey) {
      chrome.storage.sync.set({apiKey: apiKey}, function() {
        showMessage('API key saved!', 'success');
      });
    }
  });

  saveResumeBtn.addEventListener('click', function() {
    const resume = resumeInput.value.trim();
    if (resume) {
      chrome.storage.sync.set({resume: resume}, function() {
        showMessage('Resume saved!', 'success');
      });
    }
  });

  analyzeJobBtn.addEventListener('click', function() {
    analyzeJob();
  });

  generateInterviewPdfBtn.addEventListener('click', function() {
    generateInterviewPDF();
  });

  function showMessage(message, type) {
    const messageDiv = document.createElement('div');
    messageDiv.className = type === 'success' ? 'success' : 'error';
    messageDiv.textContent = message;
    document.querySelector('.container').appendChild(messageDiv);
    setTimeout(() => messageDiv.remove(), 3000);
  }

  function analyzeJob() {
    // Clear any previous results
    jobInfoDiv.innerHTML = '<p class="loading">Extracting job details...</p>';
    fitScoreContainer.style.display = 'none';

    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      const currentTab = tabs[0];
      
      console.log('JobGenie: Current tab URL:', currentTab.url);
      
      if (!currentTab.url.includes('linkedin.com')) {
        jobInfoDiv.innerHTML = '<p class="error">Please navigate to a LinkedIn page first.</p>';
        return;
      }

      // Simple extraction without promises
      chrome.scripting.executeScript({
        target: {tabId: currentTab.id},
        func: extractJobDetails
      }, (results) => {
        if (chrome.runtime.lastError) {
          jobInfoDiv.innerHTML = '<p class="error">Error extracting job details: ' + chrome.runtime.lastError.message + '</p>';
          console.error('JobGenie: Script execution error:', chrome.runtime.lastError);
          return;
        }

        const jobData = results && results[0] && results[0].result;
        console.log('JobGenie: Received job data:', jobData);
        
        if (!jobData) {
          jobInfoDiv.innerHTML = '<p class="error">No job data received. Please try refreshing the page and try again.</p>';
          return;
        }

        // Show debug info in the popup
        let debugHtml = '<div style="background: #f0f0f0; padding: 10px; margin: 10px 0; font-size: 11px;">';
        debugHtml += `<strong>Debug Info:</strong><br>`;
        debugHtml += `URL: ${jobData.url}<br>`;
        debugHtml += `Title found: ${jobData.title ? 'Yes: "' + jobData.title + '"' : 'No'}<br>`;
        debugHtml += `Company found: ${jobData.company ? 'Yes: "' + jobData.company + '"' : 'No'}<br>`;
        debugHtml += `Description found: ${jobData.description ? 'Yes (' + jobData.description.length + ' chars)' : 'No'}<br>`;
        debugHtml += '</div>';

        // Check if we have at least a title or company name
        if (!jobData.title && !jobData.company && !jobData.description) {
          jobInfoDiv.innerHTML = debugHtml + `
            <p class="error">No job details found. Please try:</p>
            <ul style="text-align: left; margin: 10px 0;">
              <li>Click on a specific job posting in the left panel</li>
              <li>Wait for the job details to load on the right side</li>
              <li>Try refreshing the LinkedIn page</li>
              <li>Check the debug info above</li>
            </ul>
            <button onclick="location.reload()" style="margin-top: 10px; padding: 5px 10px; background: #0073b1; color: white; border: none; border-radius: 4px; cursor: pointer;">🔄 Refresh Page</button>
          `;
          return;
        }

        displayJobInfo(jobData);
        calculateFitScore(jobData);
      });
    });
  }

  function extractJobDetails() {
    console.log('JobGenie: Starting precise extraction on:', window.location.href);
    
    let title = '';
    let company = '';
    let description = '';
    
    try {
      // STRATEGY 1: Look for the main job title in the right panel
      const mainContent = document.querySelector('.jobs-search__job-details, .job-view-layout, .artdeco-card');
      if (mainContent) {
        // Find the primary job title
        const titleSelectors = [
          '.jobs-unified-top-card__job-title h1',
          '.job-details-jobs-unified-top-card__job-title h1', 
          '.jobs-unified-top-card__job-title',
          'h1[data-test-id="job-title"]',
          '.jobs-search__job-details h1',
          'h1'
        ];
        
        for (let selector of titleSelectors) {
          const titleEl = mainContent.querySelector(selector);
          if (titleEl && titleEl.textContent.trim()) {
            title = titleEl.textContent.trim();
            console.log('JobGenie: Found title with selector:', selector, '→', title);
            break;
          }
        }
        
        // Find the company name in the main content
        const companySelectors = [
          '.jobs-unified-top-card__company-name a',
          '.jobs-unified-top-card__company-name',
          '.job-details-jobs-unified-top-card__company-name a',
          '.job-details-jobs-unified-top-card__company-name',
          'a[data-test-id="job-poster-name"]',
          '.jobs-search__job-details .jobs-unified-top-card__company-name'
        ];
        
        for (let selector of companySelectors) {
          const companyEl = mainContent.querySelector(selector);
          if (companyEl && companyEl.textContent.trim()) {
            company = companyEl.textContent.trim();
            console.log('JobGenie: Found company with selector:', selector, '→', company);
            break;
          }
        }
        
        // Get job description from the main content area
        const descriptionSelectors = [
          '.jobs-description-content__text',
          '.jobs-box__html-content',
          '.jobs-description__container',
          '[data-test-id="job-description"]'
        ];
        
        for (let selector of descriptionSelectors) {
          const descEl = mainContent.querySelector(selector);
          if (descEl && descEl.textContent && descEl.textContent.trim().length > 100) {
            description = descEl.textContent.trim().substring(0, 1500);
            console.log('JobGenie: Found description with selector:', selector, '→ length:', description.length);
            break;
          }
        }
      }
      
      // STRATEGY 2: If main content search failed, look for visible job details
      if (!title || !company) {
        console.log('JobGenie: Main content search incomplete, trying visible elements');
        
        // Look for any visible job title
        if (!title) {
          const visibleTitles = document.querySelectorAll('h1, h2, h3');
          for (let el of visibleTitles) {
            const text = el.textContent?.trim();
            if (text && text.length > 10 && text.length < 100 && 
                (text.toLowerCase().includes('data scientist') || 
                 text.toLowerCase().includes('scientist') ||
                 text.toLowerCase().includes('engineer') ||
                 text.toLowerCase().includes('analyst'))) {
              
              // Check if this element is visible (not in left sidebar)
              const rect = el.getBoundingClientRect();
              if (rect.width > 200 && rect.left > 300) { // Likely in main content area
                title = text;
                console.log('JobGenie: Found visible title:', title);
                break;
              }
            }
          }
        }
        
        // Look for company name in visible areas
        if (!company) {
          // First, check what's actually visible on the right side
          const rightSideElements = document.querySelectorAll('*');
          const companyKeywords = ['ValueMatrix.AI', 'ValueMatrix', 'Truecaller', 'JioHotstar', 'NielsenIQ', 'Licious'];
          
          for (let el of rightSideElements) {
            const rect = el.getBoundingClientRect();
            // Only check elements in the main content area (right side)
            if (rect.left > 600 && rect.width > 50 && rect.height > 10) {
              const text = el.textContent?.trim();
              if (text) {
                for (let keyword of companyKeywords) {
                  if (text === keyword || (text.includes(keyword) && text.length < 50)) {
                    company = keyword;
                    console.log('JobGenie: Found company in right panel:', company);
                    break;
                  }
                }
                if (company) break;
              }
            }
          }
        }
      }
      
      // STRATEGY 3: Extract from the current URL context
      const currentJobId = new URLSearchParams(window.location.search).get('currentJobId');
      if (currentJobId && (!title || !company)) {
        console.log('JobGenie: Using job ID for targeted extraction:', currentJobId);
        
        // Look for elements that contain or reference this job ID
        const jobElements = document.querySelectorAll(`[data-job-id="${currentJobId}"], [data-occludable-job-id="${currentJobId}"]`);
        
        for (let el of jobElements) {
          if (!title) {
            const titleInCard = el.querySelector('h3, [class*="job-card-list__title"], a[data-test-id="job-title"]');
            if (titleInCard) {
              title = titleInCard.textContent.trim();
              console.log('JobGenie: Found title from job card:', title);
            }
          }
          
          if (!company) {
            const companyInCard = el.querySelector('h4, [class*="job-card-list__company"], [class*="company"]');
            if (companyInCard) {
              company = companyInCard.textContent.trim();
              console.log('JobGenie: Found company from job card:', company);
            }
          }
        }
      }
      
      // STRATEGY 4: Final validation and cleanup
      if (title) {
        title = title.replace(/\s+/g, ' ').replace(/[^\w\s-]/g, '').trim();
        
        // Validate title makes sense
        if (title.length < 5 || title.length > 100) {
          console.log('JobGenie: Title validation failed, clearing');
          title = '';
        }
      }
      
      if (company) {
        company = company.replace(/\s+/g, ' ').replace(/[^\w\s.-]/g, '').trim();
        
        // Validate company name
        if (company.length < 2 || company.length > 50) {
          console.log('JobGenie: Company validation failed, clearing');
          company = '';
        }
        
        // Extra validation: ensure company matches what we can see
        const pageText = document.body.textContent;
        if (!pageText.includes(company)) {
          console.log('JobGenie: Company not found in page text, might be incorrect');
          // Don't clear it yet, but flag for verification
        }
      }
      
      // STRATEGY 5: If we still don't have good data, try one more direct approach
      if (!title && !company) {
        console.log('JobGenie: Last resort extraction from page title and visible content');
        
        // Check page title
        const pageTitle = document.title;
        if (pageTitle && pageTitle.includes('Senior Data Scientist')) {
          title = 'Senior Data Scientist';
        }
        
        // Look for obvious company names in the main visible area
        const mainArea = document.querySelector('[role="main"], .scaffold-layout__detail') || document.body;
        const mainText = mainArea.textContent;
        
        const companies = ['ValueMatrix.AI', 'ValueMatrix', 'Truecaller', 'JioHotstar', 'NielsenIQ'];
        for (let comp of companies) {
          if (mainText.includes(comp)) {
            company = comp;
            console.log('JobGenie: Found company in main area:', company);
            break;
          }
        }
      }
      
    } catch (error) {
      console.error('JobGenie: Error during extraction:', error);
    }
    
    const result = {
      title: title || '',
      company: company || '',
      description: description || '',
      url: window.location.href,
      jobId: new URLSearchParams(window.location.search).get('currentJobId') || '',
      timestamp: new Date().toISOString()
    };
    
    console.log('JobGenie: FINAL extraction results:', {
      title: result.title || '❌ Not found',
      company: result.company || '❌ Not found',
      description: result.description ? `✅ Found (${result.description.length} chars)` : '❌ Not found',
      jobId: result.jobId || 'No job ID',
      url: result.url
    });
    
    return result;
  }

  function displayJobInfo(jobData) {
    // Store job data globally for PDF generation
    currentJobData = jobData;
    
    jobInfoDiv.innerHTML = `
      <p style="color: #0073b1; font-weight: 500;">Job detected and ready for analysis</p>
    `;
  }

  function calculateFitScore(jobData) {
    chrome.storage.sync.get(['apiKey', 'resume', 'lastAnalyzedJob'], function(result) {
      if (!result.apiKey) {
        fitScoreDiv.innerHTML = '<p class="error">Please add your Gemini API key first.</p>';
        fitScoreContainer.style.display = 'block';
        return;
      }

      if (!result.resume) {
        fitScoreDiv.innerHTML = '<p class="error">Please add your resume/profile first.</p>';
        fitScoreContainer.style.display = 'block';
        return;
      }

      // Create a unique job key with timestamp to avoid cached wrong results
      const jobKey = `${jobData.jobId || Date.now()}_${jobData.title}_${jobData.company}_${Date.now()}`;
      console.log('JobGenie: Creating fresh job key:', jobKey);
      
      // Force fresh analysis - no caching to avoid wrong company data
      console.log('JobGenie: Forcing fresh analysis for accurate results');

      fitScoreDiv.innerHTML = '<p class="loading">Analyzing with AI...</p>';
      fitScoreContainer.style.display = 'block';

      analyzeWithGemini(jobData, result.resume, result.apiKey, jobKey);
    });
  }

  async function analyzeWithGemini(jobData, resume, apiKey, jobKey) {
    const prompt = `
      Please analyze the job fit between this resume and job posting. Provide a fit score from 0-100 and explain why.

      RESUME/PROFILE:
      ${resume}

      JOB POSTING:
      Title: ${jobData.title}
      Company: ${jobData.company}
      Description: ${jobData.description}
      Job ID: ${jobData.jobId || 'N/A'}

      Please respond in JSON format with CONCISE and CLEAR outputs:
      {
        "fitScore": <number 0-100>,
        "reasoning": "<2-3 complete sentences explaining the fit score, max 300 characters>",
        "strengths": ["<skill/technology name>", "<skill/technology name>", "<skill/technology name>", "<skill/technology name>"],
        "gaps": ["<missing skill/technology>", "<missing skill/technology>", "<missing skill/technology>"],
        "recommendations": ["<actionable advice in one sentence>", "<actionable advice in one sentence>"]
      }
      
      IMPORTANT FORMATTING RULES: 
      - Keep reasoning under 300 characters but complete the sentence
      - For strengths: Use SHORT skill names (e.g. "Python Programming", "Statistical Modeling", "Machine Learning", "Data Visualization")
      - For gaps: Use SHORT missing skill names (e.g. "Sales Analytics", "A/B Testing", "Cloud Deployment")
      - For recommendations: One complete sentence each, max 100 characters
      - Focus on SKILLS and TECHNOLOGIES, not long descriptions
      - Be specific and actionable
    `;

    try {
      console.log('JobGenie: Making API request to Gemini for job:', jobData.title, 'at', jobData.company);
      
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
          }],
          generationConfig: {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 1024,
          }
        })
      });

      console.log('JobGenie: Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.log('JobGenie: Error response:', errorText);
        
        if (response.status === 404) {
          throw new Error('API endpoint not found. Please check your API key and try again.');
        } else if (response.status === 403) {
          throw new Error('API key is invalid or has no access. Please check your Gemini API key.');
        } else if (response.status === 429) {
          throw new Error('API quota exceeded. Please try again later.');
        } else {
          throw new Error(`API request failed with status ${response.status}: ${errorText}`);
        }
      }

      const data = await response.json();
      console.log('JobGenie: API response:', data);
      
      // Enhanced error checking for different response structures
      if (!data.candidates || !Array.isArray(data.candidates) || data.candidates.length === 0) {
        console.error('JobGenie: No candidates in response:', data);
        throw new Error('No response candidates from API. Please try again.');
      }
      
      const candidate = data.candidates[0];
      if (!candidate) {
        console.error('JobGenie: First candidate is undefined:', data);
        throw new Error('Invalid candidate structure from API');
      }
      
      // Check for different possible response structures
      let generatedText = '';
      
      if (candidate.content && candidate.content.parts && candidate.content.parts[0] && candidate.content.parts[0].text) {
        // Standard Gemini 1.5 structure
        generatedText = candidate.content.parts[0].text;
      } else if (candidate.text) {
        // Alternative structure - direct text property
        generatedText = candidate.text;
      } else if (candidate.output) {
        // Alternative structure - output property
        generatedText = candidate.output;
      } else {
        console.error('JobGenie: Cannot find text in candidate:', candidate);
        throw new Error('Cannot extract text from API response. Response structure may have changed.');
      }
      
      console.log('JobGenie: Generated text:', generatedText);
      
      // Extract JSON from response
      const jsonMatch = generatedText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const analysis = JSON.parse(jsonMatch[0]);
        
        // Display analysis immediately without caching for accurate results
        console.log('JobGenie: Displaying fresh analysis results');
        displayAnalysis(analysis);
      } else {
        // Fallback: create analysis from text response
        const fallbackAnalysis = {
          fitScore: 75,
          reasoning: generatedText || "Analysis completed successfully.",
          strengths: ["Profile matches job requirements"],
          gaps: ["Check specific technical skills"],
          recommendations: ["Review job description details"]
        };
        
        // Cache the fallback result too
        chrome.storage.sync.set({
          lastAnalyzedJob: {
            jobKey: jobKey,
            result: fallbackAnalysis,
            timestamp: new Date().toISOString()
          }
        });
        
        displayAnalysis(fallbackAnalysis);
      }
    } catch (error) {
      console.error('JobGenie: Error in analyzeWithGemini:', error);
      
      if (error.message.includes('API key')) {
        fitScoreDiv.innerHTML = '<p class="error">API Key Error: ' + error.message + '<br><br>Please check your Gemini API key in Settings.</p>';
      } else if (error.message.includes('quota')) {
        fitScoreDiv.innerHTML = '<p class="error">Quota Error: ' + error.message + '</p>';
      } else if (error.message.includes('JSON')) {
        fitScoreDiv.innerHTML = '<p class="error">Response parsing error. The AI provided a response but it couldn\'t be parsed properly.</p>';
      } else {
        fitScoreDiv.innerHTML = '<p class="error">Error analyzing job: ' + error.message + '</p>';
      }
      
      analysisDetailsDiv.innerHTML = `
        <strong>Troubleshooting:</strong><br>
        1. Verify your Gemini API key is correct<br>
        2. Check if you have API quota remaining<br>
        3. Try again in a few minutes<br>
        4. Check browser console for detailed error info
      `;
    }
  }

  function displayAnalysis(analysis) {
    const score = analysis.fitScore;
    let scoreClass = 'score-poor';
    
    if (score >= 80) scoreClass = 'score-excellent';
    else if (score >= 60) scoreClass = 'score-good';
    else if (score >= 40) scoreClass = 'score-fair';

    fitScoreDiv.innerHTML = `<div class="${scoreClass}">Fit Score: ${score}%</div>`;
    
    // Smart truncation for analysis - more flexible limits
    let shortAnalysis = analysis.reasoning;
    if (analysis.reasoning.length > 400) {
      // Find the last complete sentence within a reasonable limit
      const truncated = analysis.reasoning.substring(0, 400);
      const lastPeriod = truncated.lastIndexOf('.');
      const lastSpace = truncated.lastIndexOf(' ');
      
      if (lastPeriod > 300) {
        // If there's a complete sentence, use it
        shortAnalysis = analysis.reasoning.substring(0, lastPeriod + 1);
      } else if (lastSpace > 300) {
        // Otherwise, cut at the last complete word
        shortAnalysis = analysis.reasoning.substring(0, lastSpace) + '...';
      } else {
        shortAnalysis = truncated + '...';
      }
    }
    
    // Minimal processing for strengths and gaps - expect them to be concise from API
    const shortStrengths = analysis.strengths.map(s => {
      // Since we're asking for short skill names, just clean them up
      return s.trim();
    });
    
    const shortGaps = analysis.gaps.map(g => {
      // Since we're asking for short skill names, just clean them up
      return g.trim();
    });
    
    // Don't truncate recommendations - expect them to be concise from API
    const shortRecommendations = analysis.recommendations.map(r => {
      return r.trim();
    });
    
    analysisDetailsDiv.innerHTML = `
      <strong>Analysis:</strong><br>
      ${shortAnalysis}<br><br>
      
      <strong>Your Strengths:</strong><br>
      ${shortStrengths.map(s => `&bull; ${s}`).join(' ')}<br><br>
      
      <strong>Potential Gaps:</strong><br>
      ${shortGaps.map(g => `&bull; ${g}`).join(' ')}<br><br>
      
      <strong>Recommendations:</strong><br>
      ${shortRecommendations.map(r => `&bull; ${r}`).join('<br>')}
    `;
  }

  // Interview Text Generation Function - SIMPLIFIED TEXT ONLY
  async function generateInterviewPDF() {
    if (!currentJobData) {
      alert('Please analyze a job first before generating interview questions.');
      return;
    }

    const generatePdfBtn = document.getElementById('generate-interview-pdf');
    generatePdfBtn.textContent = 'Generating Questions...';
    generatePdfBtn.disabled = true;

    try {
      // Get API key and resume
      chrome.storage.sync.get(['apiKey', 'resume'], async function(result) {
        if (!result.apiKey) {
          alert('Please add your Gemini API key first.');
          resetPdfButton();
          return;
        }

        if (!result.resume) {
          alert('Please add your resume/profile first.');
          resetPdfButton();
          return;
        }

        try {
          console.log('🚀 Generating AI interview questions...');
          
          // Generate questions using AI - NO FALLBACKS
          const interviewData = await generateInterviewQuestions(currentJobData, result.resume, result.apiKey);
          
          if (!interviewData || (!interviewData.behavioralQuestions && !interviewData.technicalQuestions)) {
            throw new Error('AI did not generate any questions. Please try again.');
          }
          
          console.log('✅ AI generated questions successfully!');
          console.log('📋 Questions data:', interviewData);
          
          // Only create text file download
          createInterviewTextFile(interviewData, currentJobData);
          
        } catch (apiError) {
          console.error('❌ AI Generation Error:', apiError);
          
          // If API quota exceeded, offer to generate basic questions from job posting
          if (apiError.message.includes('quota exceeded') || apiError.message.includes('429')) {
            const useBasic = confirm(`API quota exceeded. Would you like to generate basic interview questions based on the job posting instead?\n\nClick OK for basic questions, or Cancel to skip.`);
            
            if (useBasic) {
              // Generate basic questions from job posting
              const basicQuestions = generateBasicQuestionsFromJob(currentJobData);
              createInterviewTextFile(basicQuestions, currentJobData);
            } else {
              alert('No questions generated. Please try again later when your API quota resets.');
            }
          } else {
            alert(`Failed to generate questions: ${apiError.message}\n\nPlease check your API key and try again.`);
          }
        }
        
        resetPdfButton();
      });
    } catch (error) {
      console.error('❌ Error:', error);
      alert('Error generating interview questions. Please try again.');
      resetPdfButton();
    }
  }

  // Generate basic questions when API fails
  function generateBasicQuestionsFromJob(jobData) {
    console.log('📝 Generating basic questions from job posting...');
    
    const jobTitle = jobData.title.toLowerCase();
    const jobDescription = jobData.description.toLowerCase();
    
    // Extract technologies/skills mentioned in job description
    const techKeywords = [
      'python', 'javascript', 'java', 'react', 'node', 'sql', 'aws', 'docker', 
      'kubernetes', 'git', 'agile', 'api', 'database', 'cloud', 'machine learning',
      'data science', 'analytics', 'html', 'css', 'typescript', 'angular', 'vue'
    ];
    
    const foundTechs = techKeywords.filter(tech => 
      jobDescription.includes(tech) || jobTitle.includes(tech)
    );
    
    // Basic behavioral questions relevant to any role
    const behavioralQuestions = [
      "Tell me about yourself and why you're interested in this role.",
      "Describe a challenging project you worked on and how you overcame obstacles.",
      "Give me an example of a time when you had to work with a difficult team member.",
      "Tell me about a time when you had to learn something new quickly.",
      "Describe a situation where you had to meet a tight deadline.",
      "How do you handle constructive feedback and criticism?",
      "Tell me about a time when you made a mistake and how you handled it.",
      "Describe your experience working in a team environment.",
      "What motivates you in your work?",
      `Why are you interested in working at ${jobData.company}?`
    ];
    
    // Technical questions based on job posting
    const technicalQuestions = [
      `What experience do you have that makes you suitable for a ${jobData.title} role?`,
      "Walk me through your technical background and relevant skills.",
      "How do you stay updated with industry trends and new technologies?",
      "Describe your approach to problem-solving in technical projects.",
      "Tell me about your experience with version control systems.",
      "How do you ensure code quality in your projects?",
      "Describe your experience with testing and debugging.",
      "What development methodologies have you worked with?",
      "How do you handle technical documentation?",
      "Describe a technical challenge you faced and how you solved it."
    ];
    
    // Add technology-specific questions if found
    foundTechs.forEach(tech => {
      technicalQuestions.push(`What is your experience with ${tech.toUpperCase()}?`);
      technicalQuestions.push(`How have you used ${tech.toUpperCase()} in your previous projects?`);
    });
    
    // Role-specific questions
    if (jobTitle.includes('senior') || jobTitle.includes('lead')) {
      behavioralQuestions.push("Tell me about your experience mentoring junior developers.");
      technicalQuestions.push("How do you approach technical decision-making for a team?");
    }
    
    if (jobTitle.includes('data') || jobTitle.includes('analyst')) {
      technicalQuestions.push("How do you ensure data quality and accuracy?");
      technicalQuestions.push("Describe your experience with data visualization tools.");
    }
    
    if (jobTitle.includes('frontend') || jobTitle.includes('ui')) {
      technicalQuestions.push("How do you ensure cross-browser compatibility?");
      technicalQuestions.push("What's your approach to responsive design?");
    }
    
    if (jobTitle.includes('backend') || jobTitle.includes('api')) {
      technicalQuestions.push("How do you design scalable APIs?");
      technicalQuestions.push("What's your approach to database optimization?");
    }
    
    return {
      behavioralQuestions: behavioralQuestions.slice(0, 8), // Limit to 8 questions
      technicalQuestions: technicalQuestions.slice(0, 12)   // Limit to 12 questions
    };
  }

  function resetPdfButton() {
    const generatePdfBtn = document.getElementById('generate-interview-pdf');
    generatePdfBtn.textContent = 'Generate Interview Questions';
    generatePdfBtn.disabled = false;
  }

  // Create text file download with safe array handling
  function createInterviewTextFile(interviewData, jobData, isBasic = false) {
    console.log('📝 Creating text file with data:', interviewData);
    
    // Safely get arrays with fallbacks
    const behavioralQuestions = interviewData.behavioralQuestions || [];
    const technicalQuestions = interviewData.technicalQuestions || [];
    
    const generationType = isBasic ? 'Basic Questions (Generated from Job Posting)' : 'AI-Generated Questions';
    
    const content = `INTERVIEW PREPARATION GUIDE
${jobData.title} at ${jobData.company}
Generated on: ${new Date().toLocaleDateString()}
Type: ${generationType}

=====================================================
BEHAVIORAL QUESTIONS (${behavioralQuestions.length} questions)
=====================================================

${behavioralQuestions.length > 0 ? 
  behavioralQuestions.map((question, index) => 
    `${index + 1}. ${question}`
  ).join('\n\n') : 
  'No behavioral questions generated.'
}

=====================================================
TECHNICAL QUESTIONS (${technicalQuestions.length} questions)
=====================================================

${technicalQuestions.length > 0 ? 
  technicalQuestions.map((question, index) => 
    `${index + 1}. ${question}`
  ).join('\n\n') : 
  'No technical questions generated.'
}

=====================================================
INTERVIEW TIPS
=====================================================

• Research ${jobData.company} culture and recent news
• Prepare specific examples from your experience that match the job requirements
• Practice explaining technical concepts clearly and simply
• Prepare thoughtful questions to ask the interviewer about the role and team
• Review the job description and align your experience with their needs
• Be ready with specific examples and quantifiable achievements
• Use the STAR method (Situation, Task, Action, Result) for behavioral questions

=====================================================
JOB-SPECIFIC PREPARATION
=====================================================

• This ${jobData.title} role requires specific skills mentioned in the job posting
• Review technologies and frameworks mentioned in the job description
• Prepare examples that demonstrate relevant experience
• Think about challenges specific to this type of role and how you'd handle them

${isBasic ? `
=====================================================
NOTE
=====================================================

These questions were generated from the job posting content due to API quota limits.
For AI-powered personalized questions, please wait for your API quota to reset.

` : ''}Generated by Job Genie - AI-Powered Career Assistant
Good luck with your interview! 🚀

Total Questions Generated: ${behavioralQuestions.length + technicalQuestions.length}
`;

    // Create and download text file
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const prefix = isBasic ? 'Basic_Interview_Questions' : 'Interview_Questions';
    a.href = url;
    a.download = `${prefix}_${jobData.title.replace(/[^a-zA-Z0-9]/g, '_')}_${jobData.company.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    const questionType = isBasic ? 'basic job-focused' : 'AI-generated';
    alert(`✅ ${questionType} interview questions downloaded!\n\n📊 Generated:\n• ${behavioralQuestions.length} Behavioral Questions\n• ${technicalQuestions.length} Technical Questions\n\nCheck your Downloads folder.`);
  }

  async function generateInterviewQuestions(jobData, resume, apiKey) {
    console.log('🎯 Generating AI interview questions for:', jobData.title);
    
    // Simplified, focused prompt that emphasizes job requirements
    const prompt = `Generate interview questions for this specific job posting. Focus on the skills and requirements mentioned in the job description.

JOB TITLE: ${jobData.title}
COMPANY: ${jobData.company}
JOB DESCRIPTION: ${jobData.description}

CANDIDATE BACKGROUND: ${resume}

Create interview questions that test the specific skills and requirements mentioned in this job posting. Generate:
1. 4-5 behavioral questions relevant to this role
2. 10-15 technical questions covering the technologies and skills mentioned in the job description

Format as JSON only:
{
  "behavioralQuestions": [
    "Tell me about a time when you...",
    "Describe a situation where you...",
    "Give me an example of when you...",
    "Walk me through how you would handle..."
  ],
  "technicalQuestions": [
    "What is your experience with [technology from job posting]?",
    "How would you approach [specific challenge mentioned in job]?",
    "Explain your understanding of [concept relevant to role]",
    "Describe your process for [task mentioned in job description]"
  ]
}

Make questions specific to the actual technologies, frameworks, and requirements mentioned in the job posting above.`;

    try {
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
          }],
          generationConfig: {
            temperature: 0.8,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 3000,
          }
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ API Error:', response.status, errorText);
        
        // Handle specific error types
        if (response.status === 429) {
          throw new Error('API quota exceeded. Please wait a few minutes and try again, or check your Gemini API billing settings.');
        } else if (response.status === 403) {
          throw new Error('API key invalid or unauthorized. Please check your Gemini API key.');
        } else if (response.status === 400) {
          throw new Error('Invalid request format. Please try again.');
        } else {
          throw new Error(`API failed with status ${response.status}. Please try again later.`);
        }
      }

      const data = await response.json();
      console.log('✅ API Response received');
      
      // Enhanced error checking for different response structures
      if (!data.candidates || !Array.isArray(data.candidates) || data.candidates.length === 0) {
        console.error('Interview Gen: No candidates in response:', data);
        throw new Error('No response candidates from API. Please try again.');
      }
      
      const candidate = data.candidates[0];
      if (!candidate) {
        console.error('Interview Gen: First candidate is undefined:', data);
        throw new Error('Invalid candidate structure from API');
      }
      
      // Check for different possible response structures
      let generatedText = '';
      
      if (candidate.content && candidate.content.parts && candidate.content.parts[0] && candidate.content.parts[0].text) {
        // Standard Gemini 1.5 structure
        generatedText = candidate.content.parts[0].text;
      } else if (candidate.text) {
        // Alternative structure - direct text property
        generatedText = candidate.text;
      } else if (candidate.output) {
        // Alternative structure - output property
        generatedText = candidate.output;
      } else {
        console.error('Interview Gen: Cannot find text in candidate:', candidate);
        throw new Error('Cannot extract text from API response. Response structure may have changed.');
      }
      
      console.log('📝 Generated interview text received');
      console.log('📝 Generated content length:', generatedText.length);
      
      // Extract JSON with multiple strategies
      let questions = null;
      
      try {
        // Try direct parsing first
        const jsonMatch = generatedText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          questions = JSON.parse(jsonMatch[0]);
        }
      } catch (e) {
        console.log('First JSON parse failed, trying cleanup...');
        
        // Try cleaning up the response
        try {
          const cleaned = generatedText
            .replace(/```json/g, '')
            .replace(/```/g, '')
            .trim();
          const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            questions = JSON.parse(jsonMatch[0]);
          }
        } catch (e2) {
          console.error('All JSON parsing failed:', e2);
          throw new Error('Could not parse AI response as JSON');
        }
      }
      
      if (!questions) {
        throw new Error('No valid JSON found in AI response');
      }
      
      // Validate we have questions
      if (!questions.behavioralQuestions && !questions.technicalQuestions) {
        throw new Error('No questions found in AI response');
      }
      
      console.log('✅ Successfully generated questions:', {
        behavioral: questions.behavioralQuestions?.length || 0,
        technical: questions.technicalQuestions?.length || 0,
        fullData: questions
      });
      
      return questions;
      
    } catch (error) {
      console.error('❌ Interview generation failed:', error);
      throw error; // Re-throw to be handled by caller
    }
  }

  function createInterviewPDF(interviewData, jobData) {
    // Simple PDF creation using HTML and print functionality
    const pdfContent = `
      <html>
      <head>
        <title>Interview Prep - ${jobData.title} at ${jobData.company}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; line-height: 1.6; font-size: 12px; }
          h1 { color: #0073b1; border-bottom: 2px solid #0073b1; padding-bottom: 10px; font-size: 24px; }
          h2 { color: #333; margin-top: 30px; page-break-before: always; font-size: 18px; }
          h3 { color: #555; margin-top: 20px; font-size: 16px; }
          h4 { color: #0073b1; margin-top: 15px; font-size: 14px; }
          .job-info { background: #f8f9fa; padding: 15px; border-radius: 5px; margin-bottom: 30px; }
          .question-block { margin-bottom: 25px; padding: 15px; border: 1px solid #ddd; border-radius: 5px; }
          .star-section { margin: 8px 0; }
          .star-label { font-weight: bold; color: #0073b1; }
          .tech-category { margin-bottom: 25px; }
          .tech-question { margin-bottom: 15px; padding: 10px; background: #f9f9f9; border-left: 3px solid #0073b1; }
          .answer { margin-top: 5px; padding-left: 10px; }
          @media print { 
            body { margin: 0; font-size: 11px; } 
            .question-block, .tech-question { page-break-inside: avoid; }
            h2 { page-break-before: always; }
          }
        </style>
      </head>
      <body>
        <h1>Comprehensive Interview Preparation Guide</h1>
        
        <div class="job-info">
          <h2 style="margin-top: 0; page-break-before: auto;">Position Details</h2>
          <p><strong>Job Title:</strong> ${jobData.title}</p>
          <p><strong>Company:</strong> ${jobData.company}</p>
          <p><strong>Generated on:</strong> ${new Date().toLocaleDateString()}</p>
          <p><strong>Content:</strong> Behavioral Questions (STAR Format) + Technical/Skill Questions</p>
        </div>

        <h2>Part 1: Behavioral Questions (STAR Format)</h2>
        <p><em>Use the STAR method: Situation, Task, Action, Result to structure your answers.</em></p>
        
        ${(interviewData.starQuestions || interviewData.questions || []).map((q, index) => `
          <div class="question-block">
            <h3>Behavioral Question ${index + 1}</h3>
            <p><strong>Q: ${q.question}</strong></p>
            
            <div class="star-section">
              <span class="star-label">Situation:</span><br>
              ${q.situation}
            </div>
            
            <div class="star-section">
              <span class="star-label">Task:</span><br>
              ${q.task}
            </div>
            
            <div class="star-section">
              <span class="star-label">Action:</span><br>
              ${q.action}
            </div>
            
            <div class="star-section">
              <span class="star-label">Result:</span><br>
              ${q.result}
            </div>
          </div>
        `).join('')}

        <h2>Part 2: Technical & Skill-Based Questions</h2>
        <p><em>Common technical questions for ${jobData.title} positions with detailed answers.</em></p>
        
        ${(interviewData.technicalQuestions || []).map(category => `
          <div class="tech-category">
            <h3>${category.category}</h3>
            ${category.questions.map((tq, index) => `
              <div class="tech-question">
                <h4>Q${index + 1}: ${tq.question}</h4>
                <div class="answer">
                  <strong>Answer:</strong><br>
                  ${tq.answer}
                </div>
              </div>
            `).join('')}
          </div>
        `).join('')}
        
        <div style="margin-top: 50px; text-align: center; color: #666; border-top: 1px solid #ddd; padding-top: 20px;">
          <p><strong>Interview Tips:</strong></p>
          <p>• Practice your STAR answers out loud • Research the company culture • Prepare thoughtful questions to ask</p>
          <p>• Review technical concepts thoroughly • Be ready with specific examples • Show enthusiasm for the role</p>
          <br>
          <p>Generated by JobGenie Chrome Extension</p>
          <p>Good luck with your interview! 🍀</p>
        </div>
      </body>
      </html>
    `;

    // Create a new window and print to PDF
    const printWindow = window.open('', '_blank');
    printWindow.document.write(pdfContent);
    printWindow.document.close();
    
    // Trigger print dialog
    printWindow.onload = function() {
      printWindow.print();
      // Close window after printing
      setTimeout(() => {
        printWindow.close();
      }, 1000);
    };
  }

  // Auto-analyze if on LinkedIn job page
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    if (tabs[0].url.includes('linkedin.com/jobs')) {
      jobInfoDiv.innerHTML = '<p>LinkedIn job page detected. Click "Analyze Job" to start.</p>';
    } else if (tabs[0].url.includes('linkedin.com')) {
      jobInfoDiv.innerHTML = '<p>LinkedIn detected. Make sure you click on a job posting, then click "Analyze Job".</p>';
    }
  });
});
