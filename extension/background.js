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
        (async () => {
            await setupOffscreenDocument('offscreen.html');
            
            // Instruct offscreen doc to start recording using the stream ID passed from popup
            chrome.runtime.sendMessage({
                type: 'START_RECORDING',
                streamId: request.streamId
            });
            
            sendResponse({ status: 'Capture processing dispatched...' });
        })();
        return true; // Keep message channel open for async
    }

    if (request.action === 'stopTabCapture') {
        chrome.runtime.sendMessage({ type: 'STOP_RECORDING' });
        sendResponse({ status: 'Stopping capture...' });
    }
});
