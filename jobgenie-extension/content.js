// Content script for JobGenie extension
// This script runs on LinkedIn pages to help with job data extraction

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'extractJobData') {
    const jobData = extractJobDetails();
    sendResponse(jobData);
  }
});

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

// Add visual indicator when extension is active
function addExtensionIndicator() {
  if (window.location.href.includes('linkedin.com/jobs') || window.location.href.includes('linkedin.com')) {
    const indicator = document.createElement('div');
    indicator.id = 'jobgenie-indicator';
    indicator.innerHTML = '🔍 JobGenie Active - Click on a job to analyze';
    indicator.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      background: #0073b1;
      color: white;
      padding: 5px 10px;
      border-radius: 5px;
      font-size: 12px;
      z-index: 10000;
      font-family: Arial, sans-serif;
      max-width: 250px;
    `;
    document.body.appendChild(indicator);
    
    // Remove after 5 seconds
    setTimeout(() => {
      const elem = document.getElementById('jobgenie-indicator');
      if (elem) elem.remove();
    }, 5000);
  }
}

// Run when page loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', addExtensionIndicator);
} else {
  addExtensionIndicator();
}
