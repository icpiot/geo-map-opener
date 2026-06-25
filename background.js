let first = null;

function extractNumber(text) {
  const match = text.match(/-?\d+(\.\d+)?/);
  return match ? match[0] : null;
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "use-geo",
    title: "Use as Geo Coordinate",
    contexts: ["selection"]
  });
});

chrome.contextMenus.onClicked.addListener((info) => {
  if (info.menuItemId !== "use-geo") return;

  const num = extractNumber(info.selectionText);
  if (!num) return;

  if (!first) {
    first = num;
    return;
  }

  const url = `https://maps.google.com/?q=${first},${num}`;
  chrome.tabs.create({ url });

  first = null;
});
