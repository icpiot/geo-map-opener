const firstByTab = new Map();
const smartCoordinateByTab = new Map();

function extractNumber(text) {
  const match = text.match(/-?\d+(\.\d+)?/);
  return match ? match[0] : null;
}

function setupContextMenu() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: "use-geo",
      title: "Use as Geo Coordinate",
      contexts: ["all"]
    });
  });
}

chrome.runtime.onInstalled.addListener(() => {
  setupContextMenu();
});

// Recreate the menu when the service worker starts, including after reloads.
setupContextMenu();

chrome.runtime.onMessage.addListener((message, sender) => {
  if (message.type !== "geo-context" || !sender.tab) return;

  smartCoordinateByTab.set(sender.tab.id, {
    coordinate: message.coordinate,
    timestamp: Date.now()
  });
});

chrome.tabs.onRemoved.addListener((tabId) => {
  firstByTab.delete(tabId);
  smartCoordinateByTab.delete(tabId);
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== "use-geo") return;

  const tabId = tab && tab.id;
  const smart = tabId == null ? null : smartCoordinateByTab.get(tabId);
  if (smart && Date.now() - smart.timestamp < 10000 && smart.coordinate) {
    const { latitude, longitude } = smart.coordinate;
    chrome.tabs.create({ url: `https://maps.google.com/?q=${latitude},${longitude}` });
    smartCoordinateByTab.delete(tabId);
    firstByTab.delete(tabId);
    return;
  }

  const num = extractNumber(info.selectionText);
  if (!num) return;

  if (tabId == null) return;
  if (!firstByTab.has(tabId)) {
    firstByTab.set(tabId, num);
    return;
  }

  const first = firstByTab.get(tabId);
  const url = `https://maps.google.com/?q=${first},${num}`;
  chrome.tabs.create({ url });

  firstByTab.delete(tabId);
});
