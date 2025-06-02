// DOM elements
const loadingEl = document.getElementById("loading");
const contentEl = document.getElementById("content");
const totalTabsEl = document.getElementById("total-tabs");
const groupedTabsEl = document.getElementById("grouped-tabs");
const ungroupedTabsEl = document.getElementById("ungrouped-tabs");
const categoriesListEl = document.getElementById("categories-list");
const autoToggleEl = document.getElementById("auto-toggle");
const groupNowBtn = document.getElementById("group-now-btn");

// Color mapping for categories
const categoryColors = {
  Social: "blue",
  Work: "green",
  Email: "red",
  Shopping: "orange",
  Dev: "purple",
  News: "grey",
};

// Modal logic for custom category form
const showCategoryModalBtn = document.getElementById('show-category-modal');
const categoryModalOverlay = document.getElementById('category-modal-overlay');
const closeCategoryModalBtn = document.getElementById('close-category-modal');

showCategoryModalBtn.addEventListener('click', () => {
  categoryModalOverlay.style.display = 'flex';
});
closeCategoryModalBtn.addEventListener('click', () => {
  categoryModalOverlay.style.display = 'none';
});
categoryModalOverlay.addEventListener('click', (e) => {
  if (e.target === categoryModalOverlay) {
    categoryModalOverlay.style.display = 'none';
  }
});

// Initialize popup
document.addEventListener("DOMContentLoaded", async () => {
  await loadSettings();
  await loadStats();
  await loadCustomCategories();
  await loadThemePreference();
  setupEventListeners();
});

// Load settings from storage
async function loadSettings() {
  try {
    const result = await chrome.storage.sync.get(["autoGroupEnabled"]);
    const autoGroupEnabled = result.autoGroupEnabled !== false; // Default to true
    updateToggle(autoGroupEnabled);
  } catch (error) {
    console.error("Error loading settings:", error);
  }
}

// Load and display statistics
async function loadStats() {
  try {
    const stats = await new Promise((resolve) => {
      chrome.runtime.sendMessage({ action: "getStats" }, resolve);
    });

    displayStats(stats);
    loadingEl.style.display = "none";
    contentEl.style.display = "block";
  } catch (error) {
    console.error("Error loading stats:", error);
    loadingEl.textContent = "Error loading stats";
  }
}

// Display statistics in the popup
function displayStats(stats) {
  totalTabsEl.textContent = stats.total || 0;
  groupedTabsEl.textContent = stats.grouped || 0;
  ungroupedTabsEl.textContent = stats.ungrouped || 0;

  // Clear and populate categories
  categoriesListEl.innerHTML = "";

  if (stats.categories && Object.keys(stats.categories).length > 0) {
    Object.entries(stats.categories)
      .sort(([, a], [, b]) => b - a) // Sort by count descending
      .forEach(([category, count]) => {
        const categoryEl = createCategoryElement(category, count);
        categoriesListEl.appendChild(categoryEl);
      });
  } else {
    const emptyEl = document.createElement("div");
    emptyEl.className = "category-item";
    emptyEl.style.opacity = "0.6";
    emptyEl.textContent = "No categorized tabs yet";
    categoriesListEl.appendChild(emptyEl);
  }

  // Display time tracking information
  const timeTrackingListEl = document.getElementById('time-tracking-list');
  timeTrackingListEl.innerHTML = '';

  if (stats.timeSpent && Object.keys(stats.timeSpent).length > 0) {
    Object.entries(stats.timeSpent)
      .sort(([, a], [, b]) => {
        const timeA = parseInt(a.time) || 0;
        const timeB = parseInt(b.time) || 0;
        return timeB - timeA;
      })
      .forEach(([tabId, data]) => {
        const timeEntry = document.createElement('div');
        timeEntry.className = 'time-entry';
        
        const titleEl = document.createElement('div');
        titleEl.className = 'time-entry-title';
        titleEl.textContent = data.title;
        
        const durationEl = document.createElement('div');
        durationEl.className = 'time-entry-duration';
        durationEl.textContent = data.time;
        
        timeEntry.appendChild(titleEl);
        timeEntry.appendChild(durationEl);
        timeTrackingListEl.appendChild(timeEntry);
      });
  } else {
    const emptyEl = document.createElement('div');
    emptyEl.className = 'time-entry';
    emptyEl.style.opacity = '0.6';
    emptyEl.textContent = 'No time tracking data available';
    timeTrackingListEl.appendChild(emptyEl);
  }
}

// Create a category element
function createCategoryElement(category, count, color = null, emoji = null) {
  const categoryEl = document.createElement("div");
  categoryEl.className = "category-item";

  const nameEl = document.createElement("div");
  nameEl.className = "category-name";

  const colorEl = document.createElement("div");
  colorEl.className = `category-color color-${color || categoryColors[category] || "grey"}`;

  const textEl = document.createElement("span");
  textEl.textContent = emoji ? `${emoji} ${category}` : category;

  nameEl.appendChild(colorEl);
  nameEl.appendChild(textEl);

  const countEl = document.createElement("div");
  countEl.className = "category-count";
  countEl.textContent = count;

  categoryEl.appendChild(nameEl);
  categoryEl.appendChild(countEl);

  return categoryEl;
}

// Setup event listeners
function setupEventListeners() {
  // Auto-group toggle
  autoToggleEl.addEventListener("click", () => {
    const isActive = autoToggleEl.classList.contains("active");
    const newState = !isActive;

    updateToggle(newState);

    chrome.runtime.sendMessage({
      action: "toggleAutoGroup",
      enabled: newState,
    });
  });

  // Group now button
  groupNowBtn.addEventListener("click", () => {
    groupNowBtn.textContent = "⏳ Grouping...";
    groupNowBtn.disabled = true;

    chrome.runtime.sendMessage({ action: "groupNow" }, () => {
      setTimeout(() => {
        loadStats();
        groupNowBtn.textContent = "📋 Group All Tabs Now";
        groupNowBtn.disabled = false;
      }, 1000);
    });
  });
}

// Update toggle appearance
function updateToggle(enabled) {
  if (enabled) {
    autoToggleEl.classList.add("active");
  } else {
    autoToggleEl.classList.remove("active");
  }
}

// Auto-refresh stats every 5 seconds when popup is open
setInterval(() => {
  if (document.visibilityState === "visible") {
    loadStats();
  }
}, 5000);

// Fix add category logic to use modal form
const customCategoryForm = document.getElementById('custom-category-form');
customCategoryForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const name = document.getElementById('category-name').value;
  const pattern = document.getElementById('category-pattern').value;
  const color = document.getElementById('category-color').value;
  const emoji = document.getElementById('category-emoji').value;

  const customCategories = await getCustomCategories();
  customCategories[name] = { pattern, color, emoji };
  await chrome.storage.sync.set({ customCategories });

  document.getElementById('category-name').value = '';
  document.getElementById('category-pattern').value = '';
  document.getElementById('category-color').value = '#4CAF50';
  document.getElementById('category-emoji').value = '';

  categoryModalOverlay.style.display = 'none';
  loadCustomCategories();
});

// Function to load custom categories from storage
async function loadCustomCategories() {
  const customCategories = await getCustomCategories();
  const customCategoriesListEl = document.getElementById('custom-categories-list');
  customCategoriesListEl.innerHTML = '';

  Object.entries(customCategories).forEach(([name, data]) => {
    const categoryEl = createCategoryElement(name, 0, data.color, data.emoji);
    const removeButton = document.createElement('button');
    removeButton.textContent = 'Remove';
    removeButton.className = 'btn';
    removeButton.onclick = () => removeCustomCategory(name);
    categoryEl.appendChild(removeButton);
    customCategoriesListEl.appendChild(categoryEl);
  });
}

// Function to remove a custom category
async function removeCustomCategory(name) {
  const customCategories = await getCustomCategories();
  delete customCategories[name];
  await chrome.storage.sync.set({ customCategories });
  loadCustomCategories();
}

// Fix dark mode toggle and persistence
const themeToggleEl = document.getElementById('theme-toggle');
themeToggleEl.addEventListener('click', async () => {
  const isDarkMode = document.body.classList.toggle('dark-mode');
  await chrome.storage.sync.set({ darkMode: isDarkMode });
});

async function loadThemePreference() {
  const result = await chrome.storage.sync.get(['darkMode']);
  if (result.darkMode) {
    document.body.classList.add('dark-mode');
  } else {
    document.body.classList.remove('dark-mode');
  }
}
