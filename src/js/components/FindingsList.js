import { FindingCard } from './FindingCard.js';

export class FindingsList {
  constructor(containerId, findingsService) {
    this.container = document.getElementById(containerId);
    this.findingsService = findingsService;
  }

  async render() {
    try {
      // Show loading state
      this.container.innerHTML = '<div class="text-center"><p>Loading findings...</p></div>';
      
      // Fetch findings
      const findings = await this.findingsService.getAll();
      
      if (!findings || findings.length === 0) {
        this.container.innerHTML = `
          <div class="text-center text-muted">
            <p>No findings have been reported yet.</p>
          </div>
        `;
        return;
      }

      // Render findings
      this.container.innerHTML = findings
        .map(finding => FindingCard.render(finding))
        .join('');
    } catch (error) {
      console.error('Error rendering findings:', error);
      this.container.innerHTML = `
        <div class="text-center text-danger">
          <p>Failed to load findings. Please try again later.</p>
        </div>
      `;
    }
  }
}