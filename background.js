// Tab categories and their matching patterns
const TAB_CATEGORIES = {
  Social: {
    color: "blue",
    patterns: [
      "youtube.com",
      "twitter.com",
      "facebook.com",
      "instagram.com",
      "tiktok.com",
      "reddit.com",
      "linkedin.com",
      "web.whatsapp.com"
    ],
  },
  Work: {
    color: "green",
    patterns: [
      "docs.google.com",
      "sheets.google.com",
      "slides.google.com",
      "notion.so",
      "slack.com",
      "teams.microsoft.com",
      "zoom.us",
    ],
  },
  Email: {
    color: "red",
    patterns: ["gmail.com", "outlook.com", "mail.yahoo.com", "mail.google.com"],
  },
  Shopping: {
    color: "orange",
    patterns: [
      "amazon.com",
      "ebay.com",
      "etsy.com",
      "shopify.com",
      "walmart.com",
      "target.com",
    ],
  },
  Dev: {
    color: "purple",
    patterns: [
      "github.com",
      "stackoverflow.com",
      "codepen.io",
      "jsfiddle.net",
      "repl.it",
      "codesandbox.io",
      "npmjs.com",
    ],
  },
  News: {
    color: "grey",
    patterns: [
      "cnn.com",
      "bbc.com",
      "reuters.com",
      "npr.org",
      "techcrunch.com",
      "hackernews.com",
    ],
  },
  Trading: {
    color: "yellow",
    patterns: [
      "tv.dhan.co",
      "zerodha.com",
      "kite.zerodha.com",
      "upstox.com",
      "groww.in",
      "angelone.in",
      "5paisa.com",
      "icicidirect.com",
      "kotaksecurities.com",
      "hdfcsec.com"
    ],
  },
};

// Track grouped tabs to avoid re-processing
const groupedTabs = new Set();
let autoGroupEnabled = true;

// Add time tracking variables
const tabTimeTracking = new Map();
let lastActiveTabId = null;
let lastActiveTime = Date.now();

// Initialize extension
chrome.runtime.onInstalled.addListener(() => {
  console.log("Tab Tracker extension installed");
  chrome.storage.sync.set({
    autoGroupEnabled: true,
    categories: TAB_CATEGORIES,
  });
});

// Listen for new tabs
chrome.tabs.onCreated.addListener((tab) => {
  if (autoGroupEnabled) {
    setTimeout(() => groupTabsAutomatically(), 1000);
  }
});

// Listen for tab updates (URL changes)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url && autoGroupEnabled) {
    setTimeout(() => groupTabsAutomatically(), 1000);
  }
  if (changeInfo.status === 'complete' && tabId === lastActiveTabId) {
    lastActiveTime = Date.now();
  }
});

// Listen for tab removal
chrome.tabs.onRemoved.addListener((tabId) => {
  groupedTabs.delete(tabId);
  tabTimeTracking.delete(tabId);
  if (tabId === lastActiveTabId) {
    lastActiveTabId = null;
  }
});

// Main function to group tabs automatically
async function groupTabsAutomatically() {
  try {
    const tabs = await chrome.tabs.query({ currentWindow: true });
    const categories = await getCategoriesFromStorage();

    // Group tabs by category
    const tabsByCategory = {};
    const ungroupedTabs = [];

    for (const tab of tabs) {
      if (
        !tab.url ||
        tab.url.startsWith("chrome://") ||
        tab.url.startsWith("chrome-extension://")
      ) {
        continue;
      }

      const category = categorizeTab(tab.url, categories);
      if (category) {
        if (!tabsByCategory[category]) {
          tabsByCategory[category] = [];
        }
        tabsByCategory[category].push(tab);
      } else {
        ungroupedTabs.push(tab);
      }
    }

    // Create or update tab groups
    for (const [categoryName, categoryTabs] of Object.entries(tabsByCategory)) {
      if (categoryTabs.length >= 2) {
        // Only group if 2+ tabs
        await createOrUpdateTabGroup(
          categoryName,
          categoryTabs,
          categories[categoryName]
        );
      }
    }

    // Update extension badge
    updateBadge(Object.keys(tabsByCategory).length);
  } catch (error) {
    console.error("Error grouping tabs:", error);
  }
}

// Categorize a tab based on its URL
function categorizeTab(url, categories) {
  try {
    const hostname = new URL(url).hostname.toLowerCase();

    for (const [categoryName, categoryData] of Object.entries(categories)) {
      for (const pattern of categoryData.patterns) {
        if (hostname.includes(pattern)) {
          return categoryName;
        }
      }
    }
  } catch (error) {
    console.log("Error parsing URL:", url);
  }

  return null;
}

// Create or update a tab group
async function createOrUpdateTabGroup(categoryName, tabs, categoryData) {
  try {
    const tabIds = tabs.map((tab) => tab.id);

    // Check if any of these tabs are already in a group
    const existingGroups = await chrome.tabGroups.query({
      windowId: tabs[0].windowId,
    });
    let targetGroupId = null;

    for (const group of existingGroups) {
      if (group.title === categoryName) {
        targetGroupId = group.id;
        break;
      }
    }

    if (targetGroupId) {
      // Add new tabs to existing group
      const newTabIds = tabIds.filter((id) => !groupedTabs.has(id));
      if (newTabIds.length > 0) {
        await chrome.tabs.group({ tabIds: newTabIds, groupId: targetGroupId });
        newTabIds.forEach((id) => groupedTabs.add(id));
        notifyTabGrouped(categoryName);
      }
    } else {
      // Create new group
      const groupId = await chrome.tabs.group({ tabIds });
      await chrome.tabGroups.update(groupId, {
        title: categoryName,
        color: categoryData.color,
      });
      tabIds.forEach((id) => groupedTabs.add(id));
      notifyTabGrouped(categoryName);
    }
  } catch (error) {
    console.error("Error creating/updating tab group:", error);
  }
}

// Update extension badge with group count
function updateBadge(groupCount) {
  chrome.action.setBadgeText({
    text: groupCount > 0 ? groupCount.toString() : "",
  });
  chrome.action.setBadgeBackgroundColor({ color: "#4CAF50" });
}

// Get categories from storage
async function getCategoriesFromStorage() {
  const result = await chrome.storage.sync.get(["categories"]);
  return result.categories || TAB_CATEGORIES;
}

// Function to group all tabs into a single group
async function groupAllTabs() {
  try {
    const tabs = await chrome.tabs.query({ currentWindow: true });
    const validTabs = tabs.filter(tab => 
      tab.url && 
      !tab.url.startsWith("chrome://") && 
      !tab.url.startsWith("chrome-extension://")
    );

    if (validTabs.length > 0) {
      const tabIds = validTabs.map(tab => tab.id);
      const groupId = await chrome.tabs.group({ tabIds });
      await chrome.tabGroups.update(groupId, {
        title: "All Tabs",
        color: "grey"
      });
      tabIds.forEach(id => groupedTabs.add(id));
      notifyTabGrouped("All Tabs");
      updateBadge(1);
    }
  } catch (error) {
    console.error("Error grouping all tabs:", error);
  }
}

// Function to ungroup all tabs
async function ungroupAllTabs() {
  try {
    const tabs = await chrome.tabs.query({ currentWindow: true });
    const groupedTabsArray = tabs.filter(tab => tab.groupId !== -1);
    
    if (groupedTabsArray.length > 0) {
      // Ungroup all tabs
      await chrome.tabs.ungroup(groupedTabsArray.map(tab => tab.id));
      // Clear the groupedTabs set
      groupedTabs.clear();
      // Update badge
      updateBadge(0);
      notifyTabGrouped("All tabs ungrouped");
    }
  } catch (error) {
    console.error("Error ungrouping tabs:", error);
  }
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "toggleAutoGroup") {
    autoGroupEnabled = message.enabled;
    chrome.storage.sync.set({ autoGroupEnabled: message.enabled });
    sendResponse({ success: true });
  } else if (message.action === "groupNow") {
    groupAllTabs();
    sendResponse({ success: true });
  } else if (message.action === "ungroupNow") {
    ungroupAllTabs();
    sendResponse({ success: true });
  } else if (message.action === "getStats") {
    getTabStats().then((stats) => sendResponse(stats));
    return true; // Will respond asynchronously
  } else if (message.action === "group-tabs") {
    groupTabsAutomatically();
    sendResponse({ success: true });
  }
});

// Get tab statistics
async function getTabStats() {
  try {
    const tabs = await chrome.tabs.query({ currentWindow: true });
    const categories = await getCategoriesFromStorage();

    const stats = {
      total: tabs.length,
      grouped: 0,
      ungrouped: 0,
      categories: {},
      timeSpent: {},
      allGrouped: false
    };

    // Check if all tabs are in the same group
    const allTabsGrouped = tabs.every(tab => tab.groupId !== -1);
    const allInSameGroup = allTabsGrouped && tabs.length > 0 && 
      tabs.every(tab => tab.groupId === tabs[0].groupId);

    stats.allGrouped = allInSameGroup;

    for (const tab of tabs) {
      if (!tab.url || tab.url.startsWith('chrome://')) continue;

      const category = categorizeTab(tab.url, categories);
      if (category) {
        stats.categories[category] = (stats.categories[category] || 0) + 1;
      }
      
      if (tab.groupId !== -1) {
        stats.grouped++;
      } else {
        stats.ungrouped++;
      }

      // Add time tracking data
      const timeSpent = tabTimeTracking.get(tab.id) || 0;
      stats.timeSpent[tab.id] = {
        url: tab.url,
        title: tab.title,
        time: formatTimeDuration(timeSpent)
      };
    }

    return stats;
  } catch (error) {
    console.error("Error getting tab stats:", error);
    return { 
      total: 0, 
      grouped: 0, 
      ungrouped: 0, 
      categories: {}, 
      timeSpent: {},
      allGrouped: false 
    };
  }
}

// Add new function to handle custom categories
async function getCustomCategories() {
  const result = await chrome.storage.sync.get(['customCategories']);
  return result.customCategories || {};
}

// Add function to send notifications when a tab is added to a group
function notifyTabGrouped(categoryName) {
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icons/icon-128.png',
    title: 'Tab Grouped',
    message: `A tab has been added to the "${categoryName}" group.`
  });
}

// Function to sync tab groups across devices
async function syncTabGroups() {
  const tabs = await chrome.tabs.query({ currentWindow: true });
  const tabGroups = await chrome.tabGroups.query({ windowId: tabs[0].windowId });
  const tabGroupData = tabGroups.map(group => ({
    id: group.id,
    title: group.title,
    color: group.color,
    tabs: tabs.filter(tab => tab.groupId === group.id).map(tab => tab.id)
  }));

  await chrome.storage.sync.set({ tabGroups: tabGroupData });
}

// Function to collect tab analytics
async function collectTabAnalytics() {
  const tabs = await chrome.tabs.query({ currentWindow: true });
  const analytics = {
    totalTabs: tabs.length,
    groupedTabs: tabs.filter(tab => tab.groupId !== -1).length,
    ungroupedTabs: tabs.filter(tab => tab.groupId === -1).length,
    categories: {}
  };

  const categories = await getCategoriesFromStorage();
  for (const tab of tabs) {
    if (!tab.url || tab.url.startsWith('chrome://')) continue;
    const category = categorizeTab(tab.url, categories);
    if (category) {
      analytics.categories[category] = (analytics.categories[category] || 0) + 1;
    }
  }

  await chrome.storage.sync.set({ analytics });
}

// Call syncTabGroups and collectTabAnalytics periodically
setInterval(() => {
  syncTabGroups();
  collectTabAnalytics();
}, 60000); // Sync every minute

// Track active tab changes
chrome.tabs.onActivated.addListener((activeInfo) => {
  const now = Date.now();
  if (lastActiveTabId) {
    const timeSpent = now - lastActiveTime;
    const currentTime = tabTimeTracking.get(lastActiveTabId) || 0;
    tabTimeTracking.set(lastActiveTabId, currentTime + timeSpent);
  }
  lastActiveTabId = activeInfo.tabId;
  lastActiveTime = now;
});

// Format time duration
function formatTimeDuration(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}
