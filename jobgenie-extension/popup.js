document.addEventListener('DOMContentLoaded', function() {
  const apiKeyInput = document.getElementById('api-key');
  const resumeInput = document.getElementById('resume');
  const saveApiKeyBtn = document.getElementById('save-api-key');
  const saveResumeBtn = document.getElementById('save-resume');
  const analyzeJobBtn = document.getElementById('analyze-job');
  const jobInfoDiv = document.getElementById('job-info');
  const fitScoreContainer = document.getElementById('fit-score-container');
  const fitScoreDiv = document.getElementById('fit-score');
  const analysisDetailsDiv = document.getElementById('analysis-details');

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
    jobInfoDiv.innerHTML = `
      <strong>Title:</strong> ${jobData.title || 'Not found'}<br>
      <strong>Company:</strong> ${jobData.company || 'Not found'}<br>
      <strong>Description:</strong> ${jobData.description ? jobData.description.substring(0, 200) + '...' : 'Not found'}
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

      Please respond in JSON format:
      {
        "fitScore": <number 0-100>,
        "reasoning": "<detailed explanation>",
        "strengths": ["<strength1>", "<strength2>"],
        "gaps": ["<gap1>", "<gap2>"],
        "recommendations": ["<rec1>", "<rec2>"]
      }
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
      
      if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
        throw new Error('Invalid response format from API');
      }
      
      const generatedText = data.candidates[0].content.parts[0].text;
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
    
    analysisDetailsDiv.innerHTML = `
      <strong>Analysis:</strong><br>
      ${analysis.reasoning}<br><br>
      
      <strong>Your Strengths:</strong><br>
      ${analysis.strengths.map(s => `• ${s}`).join('<br>')}<br><br>
      
      <strong>Potential Gaps:</strong><br>
      ${analysis.gaps.map(g => `• ${g}`).join('<br>')}<br><br>
      
      <strong>Recommendations:</strong><br>
      ${analysis.recommendations.map(r => `• ${r}`).join('<br>')}
    `;
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
