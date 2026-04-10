let mediaRecorder;
let stream;
let audioChunks = [];

chrome.runtime.onMessage.addListener(async (message) => {
    if (message.type === 'START_RECORDING') {
        startRecording(message.streamId);
    } else if (message.type === 'STOP_RECORDING') {
        stopRecording();
    }
});

async function startRecording(streamId) {
    try {
        stream = await navigator.mediaDevices.getUserMedia({
            audio: {
                mandatory: {
                    chromeMediaSource: 'tab',
                    chromeMediaSourceId: streamId
                }
            }
        });

        // We only want to analyze the audio without muting it for the user
        // But getUserMedia from 'tab' will actually hook the audio.
        // We'll record in chunks of 5 seconds to send to the backend continuously or on stop.
        // Actually, just record until user click stop for now.

        // Play the audio back to the user via a hidden audio element
        const audioCtx = new AudioContext();
        const source = audioCtx.createMediaStreamSource(stream);
        source.connect(audioCtx.destination); // this allows the user to still hear the audio

        mediaRecorder = new MediaRecorder(stream);

        mediaRecorder.ondataavailable = event => {
            if (event.data.size > 0) {
                audioChunks.push(event.data);
            }
        };

        mediaRecorder.onstop = async () => {
            const blob = new Blob(audioChunks, { type: 'audio/webm' });
            
            // Send audio blob to python backend (Node.js API)
            await sendAudioToBackend(blob);
            
            // Clean up
            audioChunks = [];
            stream.getTracks().forEach(track => track.stop());
            audioCtx.close();
        };

        mediaRecorder.start();
        console.log("Recording started...");

    } catch (err) {
        console.error("Error accessing tab audio: ", err);
        chrome.runtime.sendMessage({
            type: 'RECORDING_ERROR',
            error: err.message
        });
    }
}

function stopRecording() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
        console.log("Recording stopped...");
    }
}

async function sendAudioToBackend(blob) {
    try {
        const formData = new FormData();
        // The backend expects an 'audio' field
        formData.append('audio', blob, 'tab-capture.webm');

        // Notify popup that processing has started
        chrome.runtime.sendMessage({ type: 'PROCESSING_START' });

        const response = await fetch('http://localhost:3000/analyze-stream', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            throw new Error(`Server returned ${response.status}`);
        }

        const data = await response.json();
        
        // Notify popup with the result
        chrome.runtime.sendMessage({
            type: 'ANALYSIS_RESULT',
            result: data
        });

    } catch (err) {
        console.error("Error sending to backend: ", err);
        chrome.runtime.sendMessage({
            type: 'ANALYSIS_ERROR',
            error: err.message
        });
    }
}
