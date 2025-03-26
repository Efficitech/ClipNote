chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.local.set({ notes: [] });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "textHighlighted") {
        // Store the highlighted text in chrome storage
        chrome.storage.local.set({ "highlightedText": message.text });
    }
});
