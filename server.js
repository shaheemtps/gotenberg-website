const express = require('express');
const multer = require('multer');
const fs = require('fs');
const FormData = require('form-data');
const https = require('https');

const app = express();
const upload = multer({ dest: 'uploads/' });

// Serve static files from the 'public' directory
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


// --- ROUTE 2: CONVERT HTML TO PDF ---
app.post('/convert-html', upload.single('htmlfile'), (req, res) => {
    const cleanupFile = () => {
        if (req.file) {
            fs.unlink(req.file.path, (err) => {
                if (err) console.error('Error deleting temp file:', err.message);
            });
        }
    };

    try {
        const form = new FormData();
        form.append('files', fs.createReadStream(req.file.path), { filename: 'index.html' });
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
        if (req.file) cleanupFile();
    }
});


// --- ROUTE 3: SPLIT PDF ---
app.post('/split', upload.single('pdffile'), (req, res) => {
    const cleanupFile = () => {
        if (req.file) {
            fs.unlink(req.file.path, (err) => {
                if (err) console.error('Error deleting temp file:', err.message);
            });
        }
    };

    try {
        const form = new FormData();
        form.append('files', fs.createReadStream(req.file.path), { filename: req.file.originalname });
        form.append('intervals', req.body.ranges);

        // <<<<<<<<<<<< ADDED THIS LINE AS A FIX >>>>>>>>>>>>
        // It's possible the split engine also requires a target format.
        form.append('pdfFormat', 'PDF/A-1b');

        console.log(`Sending PDF to Gotenberg for splitting with ranges: ${req.body.ranges}`);
        const gotenbergUrl = 'https://shaheem-gotenberg.fly.dev/forms/pdfengines/split';
        
        const request = https.request(gotenbergUrl, { method: 'POST', headers: form.getHeaders() }, (response) => {
            if (response.statusCode !== 200) {
                console.error(`Split Error - Gotenberg Status: ${response.statusCode}`);
                response.on('data', (chunk) => console.error('Gotenberg Message:', chunk.toString()));
                res.status(500).send('Sorry, Gotenberg could not process the file. Check your page ranges.');
                cleanupFile();
                return;
            }
            
            res.setHeader('Content-Type', 'application/zip');
            res.setHeader('Content-Disposition', 'attachment; filename=split-result.zip');
            response.pipe(res);
            res.on('finish', cleanupFile);
        });
        
        request.on('error', (err) => {
            console.error('Network error during split:', err.message);
            res.status(500).send('Could not connect to the Gotenberg service.');
            cleanupFile();
        });
        
        form.pipe(request);
    } catch (error) {
        console.error('Unexpected error in /split route:', error.message);
        res.status(500).send('An unexpected server error occurred.');
        if (req.file) cleanupFile();
    }
});


const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Server is running and listening on port ${PORT}`);
});