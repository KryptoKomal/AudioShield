let offscreenCreating;

// Ensure exactly one offscreen document exists
async function setupOffscreenDocument(path) {
    if (await chrome.offscreen.hasDocument()) return;
    if (offscreenCreating) {
        await offscreenCreating;
    } else {
        offscreenCreating = chrome.offscreen.createDocument({
            url: path,
            reasons: ['USER_MEDIA'],
            justification: 'Capturing tab audio for deepfake analysis'
        });
        await offscreenCreating;
        offscreenCreating = null;
    }
}

// Handle messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'startTabCapture') {
        chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
            const activeTab = tabs[0];
            if (!activeTab) {
                sendResponse({ error: 'No active tab found' });
                return;
            }

            // Get the stream ID
            chrome.tabCapture.getMediaStreamId({ targetTabId: activeTab.id }, async (streamId) => {
                if (chrome.runtime.lastError || !streamId) {
                    const errorMessage = chrome.runtime.lastError ? chrome.runtime.lastError.message : 'Failed to get stream ID';
                    console.error("Capture Error:", errorMessage);
                    sendResponse({ error: errorMessage });
                    return;
                }
                
                await setupOffscreenDocument('offscreen.html');
                
                // Instruct offscreen doc to start recording using the stream ID
                chrome.runtime.sendMessage({
                    type: 'START_RECORDING',
                    streamId: streamId
                });
                
                sendResponse({ status: 'Starting capture...' });
            });
        });
        return true; // Keep message channel open for async
    }

    if (request.action === 'stopTabCapture') {
        chrome.runtime.sendMessage({ type: 'STOP_RECORDING' });
        sendResponse({ status: 'Stopping capture...' });
    }
});
