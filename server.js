const express = require('express');
const multer = require('multer');
const fs = require('fs');
const FormData = require('form-data');
const https = require('https'); // For making requests to the https fly.dev URL

const app = express();
const upload = multer({ dest: 'uploads/' }); // Configure multer

// Serve static files (index.html) from the 'public' directory
app.use(express.static('public'));

// --- ROUTE 1: MERGE PDFs ---
app.post('/merge', upload.array('files'), (req, res) => {
    
    const cleanupFiles = () => {
        for (const file of req.files) {
            fs.unlink(file.path, (err) => {
                if (err) console.error('Error deleting temp file:', err.message);
            });
        }
    };

    try {
        const form = new FormData();
        for (const file of req.files) {
            form.append('files', fs.createReadStream(file.path), { filename: file.originalname });
        }

        console.log('Sending PDF files to Gotenberg for merging...');
        const gotenbergUrl = 'https://shaheem-gotenberg.fly.dev/forms/pdfengines/merge';
        
        const request = https.request(gotenbergUrl, { method: 'POST', headers: form.getHeaders() }, (response) => {
            if (response.statusCode !== 200) {
                console.error(`Merge Error - Gotenberg Status: ${response.statusCode}`);
                response.on('data', (chunk) => console.error('Gotenberg Message:', chunk.toString()));
                res.status(500).send('Sorry, Gotenberg could not process the files.');
                cleanupFiles();
                return;
            }
            
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', 'attachment; filename=merged-result.pdf');
            response.pipe(res);
            res.on('finish', cleanupFiles);
        });
        
        request.on('error', (err) => {
            console.error('Network error during merge:', err.message);
            res.status(500).send('Could not connect to the Gotenberg service.');
            cleanupFiles();
        });
        
        form.pipe(request);
    } catch (error) {
        console.error('Unexpected error in /merge route:', error.message);
        res.status(500).send('An unexpected server error occurred.');
        cleanupFiles();
    }
});


// --- ROUTE 2: CONVERT HTML TO PDF (NEW!) ---
app.post('/convert-html', upload.single('htmlfile'), (req, res) => {
    // upload.single('htmlfile') handles a single file upload with the name 'htmlfile'
    // The file info is available in req.file (not req.files)

    const cleanupFile = () => {
        fs.unlink(req.file.path, (err) => {
            if (err) console.error('Error deleting temp file:', err.message);
        });
    };

    try {
        const form = new FormData();
        // Gotenberg's chromium engine expects the main HTML file to be named 'index.html'
        form.append('files', fs.createReadStream(req.file.path), { filename: 'index.html' });

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


// Use the PORT provided by Render, or 4000 for local development
const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`Server is running and listening on port ${PORT}`);
});