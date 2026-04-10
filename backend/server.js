const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const app = express();
const port = 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Setup Multer for file uploads
const uploadDirectory = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDirectory)) {
    fs.mkdirSync(uploadDirectory);
}
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDirectory);
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({ storage: storage });

// Helper function to run the python analyzer
function runAnalyzer(filePath) {
    return new Promise((resolve, reject) => {
        const pythonProcess = spawn('python', ['analyzer.py', filePath], { cwd: __dirname });

        let outputData = '';
        let errorData = '';

        pythonProcess.stdout.on('data', (data) => {
            outputData += data.toString();
        });

        pythonProcess.stderr.on('data', (data) => {
            errorData += data.toString();
        });

        pythonProcess.on('close', (code) => {
            if (code !== 0) {
                console.error(`Python script exited with code ${code}. Error: ${errorData}`);
                return reject(new Error('Failed to analyze audio'));
            }
            try {
                // The python script should print a JSON string as the last line
                const lines = outputData.trim().split('\n');
                const lastLine = lines[lines.length - 1];
                const result = JSON.parse(lastLine);
                resolve(result);
            } catch (err) {
                console.error('Failed to parse python output:', outputData);
                reject(new Error('Invalid output format from analyzer'));
            }
        });
    });
}

// Routes

// 1. Analyze Uploaded File
app.post('/analyze-file', upload.single('audio'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No audio file uploaded.' });
    }

    try {
        const filePath = req.file.path;
        const result = await runAnalyzer(filePath);
        
        // Clean up the uploaded file
        fs.unlinkSync(filePath);

        res.json(result);
    } catch (error) {
        res.status(500).json({ error: 'Processing error', details: error.message });
    }
});

// 2. Analyze Audio Stream (Chunk)
// We'll treat this similar to a file for simplicity in the mock.
// The extension will send recorded chunks via Blob (multipart/form-data).
app.post('/analyze-stream', upload.single('audio'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No audio chunk uploaded.' });
    }

    try {
        const filePath = req.file.path;
        const result = await runAnalyzer(filePath);
        
        fs.unlinkSync(filePath);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: 'Processing error', details: error.message });
    }
});

app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

app.listen(port, () => {
    console.log(`DeepShield Audio Backend running at http://localhost:${port}`);
});
