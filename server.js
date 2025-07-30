const express = require('express');
const multer = require('multer');
const fs = require('fs');
const FormData = require('form-data');
const https = require('https');

const app = express();
const upload = multer({ dest: 'uploads/' });

app.use(express.static('public'));

// --- ROUTE 1: MERGE PDFs ---
app.post('/merge', (req, res) => { /* ... (This part remains the same) ... */ });


// --- ROUTE 2: CONVERT HTML TO PDF ---
app.post('/convert-html', upload.single('htmlfile'), (req, res) => {
    
    const cleanupFile = () => {
        fs.unlink(req.file.path, (err) => {
            if (err) console.error('Error deleting temp file:', err.message);
        });
    };

    try {
        const form = new FormData();
        form.append('files', fs.createReadStream(req.file.path), { filename: 'index.html' });

        // <<<<<<<<<<<< ADD THESE NEW LINES HERE >>>>>>>>>>>>
        // Set standard A4 paper size in inches for consistency.
        // This is often required by newer Gotenberg versions.
        form.append('paperWidth', 8.27);
        form.append('paperHeight', 11.69);

        console.log('Sending HTML file to Gotenberg for conversion...');
        const gotenbergUrl = 'https://shaheem-gotenberg.fly.dev/forms/chromium/convert/html';
        
        const request = https.request(gotenbergUrl, { method: 'POST', headers: form.getHeaders() }, (response) => {
            if (response.statusCode !== 200) {
                console.error(`HTML Convert Error - Gotenberg Status: ${response.statusCode}`);
                response.on('data', (chunk) => console.error('Gotenberg Message:', chunk.toString()));
                res.status(500).send('Sorry, Gotenberg could not process the file.');
                cleanupFile();
                return;
            }
            
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', 'attachment; filename=converted-result.pdf');
            response.pipe(res);
            res.on('finish', cleanupFile);
        });
        
        request.on('error', (err) => {
            console.error('Network error during HTML conversion:', err.message);
            res.status(500).send('Could not connect to the Gotenberg service.');
            cleanupFile();
        });
        
        form.pipe(request);
    } catch (error) {
        console.error('Unexpected error in /convert-html route:', error.message);
        res.status(500).send('An unexpected server error occurred.');
        cleanupFile();
    }
});


const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`Server is running and listening on port ${PORT}`);
});