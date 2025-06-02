// Content script for Tab Tracker
// This script runs on all pages to help with tab categorization

// Listen for messages from the background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "getPageInfo") {
    // Send back page information that might help with categorization
    const pageInfo = {
      title: document.title,
      url: window.location.href,
      hostname: window.location.hostname,
      // Check for common page indicators
      isEmail: checkIfEmailPage(),
      isSocial: checkIfSocialPage(),
      isWork: checkIfWorkPage(),
      isShopping: checkIfShoppingPage(),
      isDev: checkIfDevPage(),
      isNews: checkIfNewsPage(),
    };

    sendResponse(pageInfo);
  }
});

// Helper functions to detect page types
function checkIfEmailPage() {
  const emailIndicators = [
    "gmail",
    "outlook",
    "mail",
    "inbox",
    "compose",
    ".mail-",
    "#mail-",
    '[class*="mail"]',
  ];

  return emailIndicators.some(
    (indicator) =>
      document.title.toLowerCase().includes(indicator) ||
      document.querySelector(indicator) !== null
  );
}

function checkIfSocialPage() {
  const socialIndicators = [
    "youtube",
    "twitter",
    "facebook",
    "instagram",
    "tiktok",
    "reddit",
    "linkedin",
    "snapchat",
    "discord",
  ];

  return socialIndicators.some(
    (indicator) =>
      window.location.hostname.includes(indicator) ||
      document.title.toLowerCase().includes(indicator)
  );
}

function checkIfWorkPage() {
  const workIndicators = [
    "docs.google",
    "sheets.google",
    "slides.google",
    "notion",
    "slack",
    "teams",
    "zoom",
    "meet",
    "trello",
    "asana",
    "monday",
    "airtable",
  ];

  return workIndicators.some((indicator) =>
    window.location.hostname.includes(indicator)
  );
}

function checkIfShoppingPage() {
  const shoppingIndicators = [
    "amazon",
    "ebay",
    "etsy",
    "shopify",
    "walmart",
    "target",
    "bestbuy",
    "costco",
    "cart",
    "checkout",
  ];

  return (
    shoppingIndicators.some(
      (indicator) =>
        window.location.hostname.includes(indicator) ||
        window.location.pathname.includes(indicator)
    ) ||
    document.querySelector(
      '[class*="cart"], [id*="cart"], [class*="checkout"], [id*="checkout"]'
    ) !== null
  );
}

function checkIfDevPage() {
  const devIndicators = [
    "github",
    "stackoverflow",
    "codepen",
    "jsfiddle",
    "repl.it",
    "codesandbox",
    "npm",
    "developer",
    "docs",
    "api",
    "documentation",
  ];

  return devIndicators.some(
    (indicator) =>
      window.location.hostname.includes(indicator) ||
      document.title.toLowerCase().includes(indicator)
  );
}

function checkIfNewsPage() {
  const newsIndicators = [
    "cnn",
    "bbc",
    "reuters",
    "npr",
    "news",
    "techcrunch",
    "hackernews",
    "medium",
    "article",
    "breaking",
  ];

  return (
    newsIndicators.some(
      (indicator) =>
        window.location.hostname.includes(indicator) ||
        document.title.toLowerCase().includes(indicator)
    ) ||
    document.querySelector('article, [class*="article"], [class*="news"]') !==
      null
  );
}

// Optional: Add visual indicator when tab is being categorized
function showCategorizedIndicator(category) {
  const indicator = document.createElement("div");
  indicator.style.cssText = `
    position: fixed;
    top: 10px;
    right: 10px;
    background: #4CAF50;
    color: white;
    padding: 8px 12px;
    border-radius: 4px;
    font-size: 12px;
    z-index: 10000;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
  `;
  indicator.textContent = `📂 Grouped: ${category}`;
  document.body.appendChild(indicator);

  setTimeout(() => {
    indicator.remove();
  }, 2000);
}

console.log("Tab Tracker content script loaded");
