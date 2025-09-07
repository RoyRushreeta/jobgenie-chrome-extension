document.getElementById('searchBtn').addEventListener('click', async () => {
  const jobRole = document.getElementById('jobRole').value.trim();
  if (!jobRole) return;
  const resultsDiv = document.getElementById('results');
  resultsDiv.innerHTML = 'Searching...';

  // Example: Generate search URLs for LinkedIn and Indeed
  const portals = [
    {
      name: 'LinkedIn',
      url: `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(jobRole)}`
    },
    {
      name: 'Indeed',
      url: `https://www.indeed.com/jobs?q=${encodeURIComponent(jobRole)}`
    }
  ];

  let html = '<ul>';
  portals.forEach(portal => {
    html += `<li><a href="${portal.url}" target="_blank">${portal.name} Jobs</a></li>`;
  });
  html += '</ul>';
  resultsDiv.innerHTML = html;
});
