export function initializeLayout() {
  document.body.innerHTML = `
    <header>
      <nav class="navbar navbar-light bg-white shadow-sm mb-4">
        <div class="container">
          <!-- Navigation content will be injected here -->
        </div>
      </nav>
    </header>

    <main class="container py-4">
      <div id="propertyList" class="mb-5" style="display: none;"></div>
      <div id="propertyDetails" style="display: none;"></div>
      <div id="changeoverHeader" style="display: none;"></div>
      <div id="changeoverList" style="display: none;"></div>
      <div id="findingsView" style="display: none;">
        <div id="uploadForm" class="mb-4"></div>
        <div id="findingsList"></div>
      </div>
      <div id="pendingFindingsList" class="mt-5" style="display: none;"></div>
    </main>
  `;

  return {
    findingsView: document.getElementById('findingsView'),
    propertyList: document.getElementById('propertyList'),
    changeoverList: document.getElementById('changeoverList'),
    changeoverHeader: document.getElementById('changeoverHeader'),
    propertyDetails: document.getElementById('propertyDetails'),
    pendingFindingsList: document.getElementById('pendingFindingsList')
  };
}