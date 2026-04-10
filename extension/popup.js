document.addEventListener('DOMContentLoaded', () => {
    // --- Elements ---
    const btnScanTab = document.getElementById('btn-scan-tab');
    const scanTabText = document.getElementById('scan-tab-text');
    const statusDot = document.getElementById('status-dot');
    const statusText = document.getElementById('status-text');
    
    const fileUpload = document.getElementById('file-upload');
    const resultContainer = document.getElementById('result-container');
    const resultBadge = document.getElementById('result-badge');
    const resultLabel = document.getElementById('result-label');
    const confidenceValue = document.getElementById('confidence-value');
    const progressBar = document.getElementById('progressBar');
    const loadingOverlay = document.getElementById('loading-overlay');

    let isRecordingTab = false;

    // --- State Initialization ---
    // Check if recording is already happening (we can store state in chrome.storage)
    chrome.storage.local.get(['isRecordingTab', 'lastResult'], (data) => {
        if (data.isRecordingTab) {
            isRecordingTab = true;
            updateTabButtonUI(true);
            setStatus('listening', 'Capturing Tab Audio');
        }
        if (data.lastResult) {
            showResult(data.lastResult);
        }
    });

    // --- Tab Audio Capture ---
    btnScanTab.addEventListener('click', async () => {
        if (!isRecordingTab) {
            // Get streaming ID first from popup to avoid background script limitations
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                const activeTab = tabs[0];
                if (!activeTab) {
                    alert("Error: Please open a regular website (like youtube) first!");
                    return;
                }

                chrome.tabCapture.getMediaStreamId({ targetTabId: activeTab.id }, (streamId) => {
                    if (chrome.runtime.lastError || !streamId) {
                        const errorMsg = chrome.runtime.lastError ? chrome.runtime.lastError.message : "Failed to get tab audio";
                        alert("Capture Error: " + errorMsg + "\nTip: Make sure you are not on a chrome:// page!");
                        return;
                    }

                    // Start recording using the stream ID
                    chrome.runtime.sendMessage({ action: 'startTabCapture', streamId: streamId }, () => {
                        isRecordingTab = true;
                        chrome.storage.local.set({ isRecordingTab: true });
                        updateTabButtonUI(true);
                        setStatus('listening', 'Capturing Audio (5s)...');
                    });
                });
            });
        } else {
            // Stop recording
            chrome.runtime.sendMessage({ action: 'stopTabCapture' }, () => {
                isRecordingTab = false;
                chrome.storage.local.set({ isRecordingTab: false });
                updateTabButtonUI(false);
                setStatus('idle', 'System Idle');
            });
        }
    });

    // --- File Upload ---
    fileUpload.addEventListener('change', async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        // Reset UI
        hideResult();
        showLoading();
        setStatus('processing', 'Analyzing File');

        const formData = new FormData();
        formData.append('audio', file);

        try {
            const response = await fetch('http://localhost:3000/analyze-file', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) throw new Error('Network response was not ok');

            const result = await response.json();
            
            // Artificial slight delay for smooth UI transition
            setTimeout(() => {
                hideLoading();
                setStatus('idle', 'System Idle');
                showResult(result);
                chrome.storage.local.set({ lastResult: result });
            }, 500);

        } catch (error) {
            console.error('Error analyzing file:', error);
            hideLoading();
            setStatus('idle', 'System Idle');
            alert('Error analyzing file. Is the backend running?');
        }

        // Reset input
        event.target.value = '';
    });

    // --- Message Listener from Background/Offscreen ---
    chrome.runtime.onMessage.addListener((message) => {
        if (message.type === 'PROCESSING_START') {
            showLoading();
            setStatus('processing', 'Analyzing Stream');
        } else if (message.type === 'ANALYSIS_RESULT') {
            hideLoading();
            isRecordingTab = false;
            chrome.storage.local.set({ isRecordingTab: false, lastResult: message.result });
            updateTabButtonUI(false);
            setStatus('idle', 'System Idle');
            showResult(message.result);
        } else if (message.type === 'ANALYSIS_ERROR') {
            hideLoading();
            isRecordingTab = false;
            chrome.storage.local.set({ isRecordingTab: false });
            updateTabButtonUI(false);
            setStatus('idle', 'System Idle');
            alert('Analysis Error: ' + message.error);
        } else if (message.type === 'RECORDING_ERROR') {
            isRecordingTab = false;
            chrome.storage.local.set({ isRecordingTab: false });
            updateTabButtonUI(false);
            setStatus('idle', 'System Idle');
            alert('Recording Error: ' + message.error);
        }
    });

    // --- UI Helper Functions ---
    function updateTabButtonUI(isRecording) {
        if (isRecording) {
            btnScanTab.classList.add('recording');
            scanTabText.innerText = 'Stop Recording';
        } else {
            btnScanTab.classList.remove('recording');
            scanTabText.innerText = 'Scan Tab Audio';
        }
    }

    function setStatus(state, text) {
        statusText.innerText = text;
        statusDot.className = 'dot'; // reset
        if (state !== 'idle') {
            statusDot.classList.add(state);
        }
    }

    function showLoading() {
        loadingOverlay.classList.remove('hidden');
    }

    function hideLoading() {
        loadingOverlay.classList.add('hidden');
    }

    function showResult(result) {
        // result = { prediction: 'real'|'fake', confidence: 0.95 }
        resultContainer.classList.remove('hidden');
        
        resultBadge.className = 'result-badge'; // reset
        
        const isReal = result.prediction.toLowerCase() === 'real';
        
        if (isReal) {
            resultBadge.classList.add('real');
            resultLabel.innerHTML = '✅ Audio is Real';
            document.getElementById('progress-bar').style.backgroundColor = 'var(--success-green)';
        } else {
            resultBadge.classList.add('fake');
            resultLabel.innerHTML = '⚠️ AI Generated (Deepfake)';
            document.getElementById('progress-bar').style.backgroundColor = 'var(--danger-red)';
        }

        const percentage = Math.round(result.confidence * 100);
        confidenceValue.innerText = percentage + '%';
        
        // Animate width
        setTimeout(() => {
            document.getElementById('progress-bar').style.width = percentage + '%';
        }, 100);
    }

    function hideResult() {
        resultContainer.classList.add('hidden');
        document.getElementById('progress-bar').style.width = '0%';
    }
});
