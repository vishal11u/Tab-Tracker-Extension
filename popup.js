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

// Initialize popup
document.addEventListener("DOMContentLoaded", async () => {
  try {
    // Initialize modal elements after DOM is loaded
    const showCategoryModalBtn = document.getElementById('show-category-modal');
    const categoryModalOverlay = document.getElementById('category-modal-overlay');
    const closeCategoryModalBtn = document.getElementById('close-category-modal');
    const categoryForm = document.getElementById('category-form');
    const themeToggleEl = document.getElementById('theme-toggle');

    // Check if all modal elements exist
    if (!showCategoryModalBtn || !categoryModalOverlay || !closeCategoryModalBtn || !categoryForm) {
      console.error('Some modal elements are missing. Please check the HTML structure.');
      return;
    }

    // Set up modal event listeners
    showCategoryModalBtn.addEventListener('click', () => {
      categoryModalOverlay.style.display = 'flex';
      categoryModalOverlay.style.position = 'fixed';
      categoryModalOverlay.style.top = '0';
      categoryModalOverlay.style.left = '0';
      categoryModalOverlay.style.right = '0';
      categoryModalOverlay.style.bottom = '0';
      categoryModalOverlay.style.backgroundColor = 'rgba(0,0,0,0.5)';
      categoryModalOverlay.style.justifyContent = 'center';
      categoryModalOverlay.style.alignItems = 'center';
      categoryModalOverlay.style.zIndex = '1000';
    });

    closeCategoryModalBtn.addEventListener('click', () => {
      categoryModalOverlay.style.display = 'none';
    });

    categoryModalOverlay.addEventListener('click', (e) => {
      if (e.target === categoryModalOverlay) {
        categoryModalOverlay.style.display = 'none';
      }
    });

    // Handle form submission
    categoryForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const name = document.getElementById('category-name').value;
      const pattern = document.getElementById('category-pattern').value;
      const color = document.getElementById('category-color').value;

      if (!name || !pattern) {
        alert('Please fill in both category name and URL pattern');
        return;
      }

      const customCategories = await getCustomCategories();
      customCategories[name] = { pattern, color };
      await chrome.storage.sync.set({ customCategories });

      document.getElementById('category-name').value = '';
      document.getElementById('category-pattern').value = '';
      document.getElementById('category-color').value = '#4CAF50';

      categoryModalOverlay.style.display = 'none';
      loadCustomCategories();
    });

    // Set up theme toggle
    if (themeToggleEl) {
      themeToggleEl.addEventListener('click', async () => {
        const isDarkMode = document.body.classList.toggle('dark-mode');
        await chrome.storage.sync.set({ darkMode: isDarkMode });
        updateToggle(themeToggleEl, isDarkMode);
      });
    }

    await loadSettings();
    await loadStats();
    await loadCustomCategories();
    await loadThemePreference();
    setupEventListeners();
  } catch (error) {
    console.error('Error initializing popup:', error);
    loadingEl.textContent = "Error initializing extension";
  }
});

// Load settings from storage
async function loadSettings() {
  try {
    const result = await chrome.storage.sync.get(["autoGroupEnabled"]);
    const autoGroupEnabled = result.autoGroupEnabled !== false; // Default to true
    const autoToggleEl = document.getElementById('auto-toggle');
    if (autoToggleEl) {
      updateToggle(autoToggleEl, autoGroupEnabled);
    }
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

    // Update group/ungroup button state
    if (stats.allGrouped) {
      groupNowBtn.textContent = "📋 Ungroup All Tabs";
    } else {
      groupNowBtn.textContent = "📋 Group All Tabs Now";
    }
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
}

// Create a category element
function createCategoryElement(category, count, color = null) {
  const categoryEl = document.createElement("div");
  categoryEl.className = "category-item";

  const nameEl = document.createElement("div");
  nameEl.className = "category-name";

  const colorEl = document.createElement("div");
  colorEl.className = `category-color color-${color || categoryColors[category] || "grey"}`;

  const textEl = document.createElement("span");
  textEl.textContent = category;

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

    updateToggle(autoToggleEl, newState);

    chrome.runtime.sendMessage({
      action: "toggleAutoGroup",
      enabled: newState,
    });
  });

  // Group/Ungroup button
  groupNowBtn.addEventListener("click", async () => {
    const isGrouped = groupNowBtn.textContent.includes("Ungroup");
    
    if (isGrouped) {
      groupNowBtn.textContent = "⏳ Ungrouping...";
      groupNowBtn.disabled = true;

      chrome.runtime.sendMessage({ action: "ungroupNow" }, () => {
        setTimeout(() => {
          loadStats();
          groupNowBtn.disabled = false;
        }, 1000);
      });
    } else {
      groupNowBtn.textContent = "⏳ Grouping...";
      groupNowBtn.disabled = true;

      chrome.runtime.sendMessage({ action: "groupNow" }, () => {
        setTimeout(() => {
          loadStats();
          groupNowBtn.disabled = false;
        }, 1000);
      });
    }
  });
}

// Update toggle appearance
function updateToggle(toggleEl, enabled) {
  if (enabled) {
    toggleEl.classList.add("active");
  } else {
    toggleEl.classList.remove("active");
  }
}

// Auto-refresh stats every 5 seconds when popup is open
setInterval(() => {
  if (document.visibilityState === "visible") {
    loadStats();
  }
}, 5000);

// Function to get custom categories from storage
async function getCustomCategories() {
  try {
    const result = await chrome.storage.sync.get(['customCategories']);
    return result.customCategories || {};
  } catch (error) {
    console.error('Error getting custom categories:', error);
    return {};
  }
}

// Function to load custom categories from storage
async function loadCustomCategories() {
  try {
    const customCategories = await getCustomCategories();
    const customCategoriesListEl = document.getElementById('custom-categories-list');
    
    if (!customCategoriesListEl) {
      console.warn('Custom categories list element not found');
      return;
    }

    customCategoriesListEl.innerHTML = '';

    if (Object.keys(customCategories).length === 0) {
      const emptyEl = document.createElement("div");
      emptyEl.className = "category-item";
      emptyEl.style.opacity = "0.6";
      emptyEl.textContent = "No custom categories yet";
      customCategoriesListEl.appendChild(emptyEl);
      return;
    }

    Object.entries(customCategories).forEach(([name, data]) => {
      const categoryEl = createCategoryElement(name, 0, data.color);
      const removeButton = document.createElement('button');
      removeButton.textContent = 'Remove';
      removeButton.className = 'btn';
      removeButton.style.marginLeft = '10px';
      removeButton.style.padding = '4px 8px';
      removeButton.style.fontSize = '12px';
      removeButton.onclick = () => removeCustomCategory(name);
      categoryEl.appendChild(removeButton);
      customCategoriesListEl.appendChild(categoryEl);
    });
  } catch (error) {
    console.error('Error loading custom categories:', error);
  }
}

// Function to remove a custom category
async function removeCustomCategory(name) {
  try {
    const customCategories = await getCustomCategories();
    delete customCategories[name];
    await chrome.storage.sync.set({ customCategories });
    await loadCustomCategories();
  } catch (error) {
    console.error('Error removing custom category:', error);
  }
}

// Fix dark mode toggle and persistence
async function loadThemePreference() {
  try {
    const result = await chrome.storage.sync.get(['darkMode']);
    const themeToggleEl = document.getElementById('theme-toggle');
    if (result.darkMode) {
      document.body.classList.add('dark-mode');
      if (themeToggleEl) {
        updateToggle(themeToggleEl, true);
      }
    } else {
      document.body.classList.remove('dark-mode');
      if (themeToggleEl) {
        updateToggle(themeToggleEl, false);
      }
    }
  } catch (error) {
    console.error('Error loading theme preference:', error);
  }
}
