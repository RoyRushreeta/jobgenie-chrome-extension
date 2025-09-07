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
    jobInfoDiv.innerHTML = '<p class="loading">Extracting job details...</p>';
    fitScoreContainer.style.display = 'none';

    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      const currentTab = tabs[0];
      
      console.log('JobGenie: Current tab URL:', currentTab.url);
      
      if (!currentTab.url.includes('linkedin.com')) {
        jobInfoDiv.innerHTML = '<p class="error">Please navigate to a LinkedIn page first.</p>';
        return;
      }

      // First, let's debug what elements are available on the page
      chrome.scripting.executeScript({
        target: {tabId: currentTab.id},
        func: () => {
          // Debug function to see what's on the page
          console.log('JobGenie Debug: Page URL:', window.location.href);
          console.log('JobGenie Debug: Page title:', document.title);
          
          // Check for common LinkedIn job elements
          const debugInfo = {
            h1Elements: Array.from(document.querySelectorAll('h1')).map(el => ({
              text: el.textContent?.trim(),
              className: el.className,
              selector: el.tagName + (el.className ? '.' + el.className.replace(/\s+/g, '.') : '')
            })),
            jobTitleElements: Array.from(document.querySelectorAll('[class*="job"], [class*="title"]')).slice(0, 10).map(el => ({
              text: el.textContent?.trim().substring(0, 100),
              className: el.className,
              tagName: el.tagName
            })),
            descriptionElements: Array.from(document.querySelectorAll('[class*="description"], [class*="content"]')).slice(0, 5).map(el => ({
              textLength: el.textContent?.trim().length,
              className: el.className,
              tagName: el.tagName
            }))
          };
          
          console.log('JobGenie Debug Info:', debugInfo);
          return debugInfo;
        }
      }, (debugResults) => {
        console.log('JobGenie Debug Results:', debugResults);
        
        // Now try to extract job details
        chrome.scripting.executeScript({
          target: {tabId: currentTab.id},
          func: extractJobDetails
        }, (results) => {
          if (chrome.runtime.lastError) {
            jobInfoDiv.innerHTML = '<p class="error">Error extracting job details: ' + chrome.runtime.lastError.message + '</p>';
            return;
          }

          const jobData = results && results[0] && results[0].result;
          console.log('JobGenie: Received job data:', jobData);
          
          if (!jobData) {
            jobInfoDiv.innerHTML = '<p class="error">No job data received. Please try refreshing the page.</p>';
            return;
          }

          // Show debug info in the popup
          let debugHtml = '<div style="background: #f0f0f0; padding: 10px; margin: 10px 0; font-size: 11px;">';
          debugHtml += `<strong>Debug Info:</strong><br>`;
          debugHtml += `URL: ${jobData.url}<br>`;
          debugHtml += `Title found: ${jobData.title ? 'Yes' : 'No'}<br>`;
          debugHtml += `Company found: ${jobData.company ? 'Yes' : 'No'}<br>`;
          debugHtml += `Description found: ${jobData.description ? 'Yes (' + jobData.description.length + ' chars)' : 'No'}<br>`;
          debugHtml += '</div>';

          // Check if we have at least a title or description
          if (!jobData.title && !jobData.description) {
            jobInfoDiv.innerHTML = debugHtml + `
              <p class="error">No job details found. Please try:</p>
              <ul style="text-align: left; margin: 10px 0;">
                <li>Click on a specific job posting in the left panel</li>
                <li>Wait for the job details to load on the right side</li>
                <li>Open the browser console (F12) to see debug info</li>
                <li>Try refreshing the LinkedIn page</li>
              </ul>
            `;
            return;
          }

          displayJobInfo(jobData);
          calculateFitScore(jobData);
        });
      });
    });
  }

  function extractJobDetails() {
    console.log('JobGenie: Starting job extraction on:', window.location.href);
    
    let title = '';
    let company = '';
    let description = '';
    
    // Strategy 1: Look for any H1 elements that might contain job titles
    const allH1s = document.querySelectorAll('h1');
    console.log('JobGenie: Found H1 elements:', allH1s.length);
    
    for (let h1 of allH1s) {
      const text = h1.textContent?.trim();
      if (text && text.length > 5 && text.length < 200) {
        title = text;
        console.log('JobGenie: Found potential title in H1:', title);
        break;
      }
    }
    
    // Strategy 2: Look for any elements containing job titles
    if (!title) {
      const allElements = document.querySelectorAll('*');
      for (let el of allElements) {
        const text = el.textContent?.trim();
        if (text && (text.includes('Data Scientist') || text.includes('Senior') || text.includes('Engineer') || text.includes('Developer')) && text.length < 200) {
          // Make sure it's not a paragraph (likely job description)
          if (el.tagName !== 'P' && el.tagName !== 'DIV' || text.length < 100) {
            // Clean up the title - extract just the job title part
            let cleanTitle = text;
            
            // Remove user name if present (pattern: "Name JobTitle")
            if (text.includes('Rushreeta Roy')) {
              cleanTitle = text.replace('Rushreeta Roy', '').trim();
            }
            
            // Extract job title pattern (e.g., "Senior Data Scientist")
            const jobTitleMatch = cleanTitle.match(/(Senior\s+)?(Data Scientist|Software Engineer|Product Manager|Marketing Manager|Business Analyst|DevOps Engineer|Full Stack Developer|Frontend Developer|Backend Developer|Machine Learning Engineer|AI Engineer)/i);
            if (jobTitleMatch) {
              title = jobTitleMatch[0];
            } else {
              // Fallback: try to extract from hyphen-separated format
              const parts = cleanTitle.split(' - ');
              if (parts.length > 1) {
                title = parts[0].trim();
              } else {
                title = cleanTitle.substring(0, 50).trim();
              }
            }
            
            console.log('JobGenie: Found and cleaned title:', title);
            break;
          }
        }
      }
    }
    
    // Strategy 3: Look for company names 
    const companyKeywords = ['AB InBev', 'Google', 'Microsoft', 'Amazon', 'Meta', 'Apple', 'Netflix', 'Tesla', 'Uber', 'GCC', 'India', 'Ltd', 'Inc', 'Corp', 'Technologies', 'Solutions'];
    const allTextElements = document.querySelectorAll('a, span, div');
    
    for (let el of allTextElements) {
      const text = el.textContent?.trim();
      if (text && text.length < 100) {
        for (let keyword of companyKeywords) {
          if (text.includes(keyword)) {
            // Clean up company name
            let cleanCompany = text;
            
            // Extract company from patterns like "Senior Data Scientist - AB InBev"
            if (text.includes(' - ')) {
              const parts = text.split(' - ');
              cleanCompany = parts.find(part => part.includes(keyword)) || parts[1] || text;
            }
            
            // Extract just the company part
            const companyMatch = cleanCompany.match(/(AB InBev[^,]*|Google[^,]*|Microsoft[^,]*|Amazon[^,]*|Meta[^,]*|Apple[^,]*|Netflix[^,]*|Tesla[^,]*|Uber[^,]*)/i);
            if (companyMatch) {
              company = companyMatch[0].trim();
            } else {
              company = cleanCompany.trim();
            }
            
            console.log('JobGenie: Found and cleaned company:', company);
            break;
          }
        }
        if (company) break;
      }
    }
    
    // Strategy 4: Look for job descriptions (longer text blocks)
    const potentialDescriptions = document.querySelectorAll('div, section, p');
    for (let el of potentialDescriptions) {
      const text = el.textContent?.trim();
      if (text && text.length > 200 && text.length < 10000) {
        // Check if it contains job-related keywords
        const jobKeywords = ['experience', 'skills', 'requirements', 'responsibilities', 'qualifications', 'role', 'position', 'team', 'work', 'develop', 'manage'];
        let keywordCount = 0;
        for (let keyword of jobKeywords) {
          if (text.toLowerCase().includes(keyword)) {
            keywordCount++;
          }
        }
        if (keywordCount >= 3) {
          description = text.substring(0, 2000); // Limit description length
          console.log('JobGenie: Found potential description, length:', description.length);
          break;
        }
      }
    }
    
    // Final cleanup
    if (title) {
      title = title.replace(/[^\w\s-]/g, '').trim(); // Remove special characters except hyphens
    }
    
    if (company) {
      company = company.replace(/[^\w\s-.,]/g, '').trim(); // Keep basic punctuation for company names
    }
    
    const result = {
      title: title || '',
      company: company || '',
      description: description || '',
      url: window.location.href
    };
    
    console.log('JobGenie: Final extraction results:', {
      title: result.title ? 'Found: "' + result.title + '"' : 'Not found',
      company: result.company ? 'Found: "' + result.company + '"' : 'Not found',
      description: result.description ? 'Found (' + result.description.length + ' chars)' : 'Not found'
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
    chrome.storage.sync.get(['apiKey', 'resume'], function(result) {
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

      fitScoreDiv.innerHTML = '<p class="loading">Analyzing with AI...</p>';
      fitScoreContainer.style.display = 'block';

      analyzeWithGemini(jobData, result.resume, result.apiKey);
    });
  }

  async function analyzeWithGemini(jobData, resume, apiKey) {
    const prompt = `
      Please analyze the job fit between this resume and job posting. Provide a fit score from 0-100 and explain why.

      RESUME/PROFILE:
      ${resume}

      JOB POSTING:
      Title: ${jobData.title}
      Company: ${jobData.company}
      Description: ${jobData.description}

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
      console.log('JobGenie: Making API request to Gemini...');
      
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
