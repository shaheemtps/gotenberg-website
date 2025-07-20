const express = require('express');
const multer = require('multer');
const fs = require('fs');
const FormData = require('form-data');
const http = require('http');

const app = express();
const port = 4000;
const upload = multer({ dest: 'uploads/' });

app.use(express.static('public'));

app.post('/merge', upload.array('files'), (req, res) => {
    
    const cleanupFiles = () => { /* ... (no changes here) ... */ };

    try {
        const form = new FormData();
        for (const file of req.files) {
            // <<<<<<<<<<<< THE FINAL FIX IS HERE >>>>>>>>>>>>
            // We pass the original filename to Gotenberg so it knows the file type (.pdf)
            form.append('files', fs.createReadStream(file.path), { filename: file.originalname });
        }
        
        // pdfFormat is not needed for merge, let's remove it to be safe
        // form.append('pdfFormat', 'PDF/A-1b'); // This line can be removed

        const request = http.request(
            {
                method: 'POST',
                host: '127.0.0.1',
                port: 3000,
                path: '/forms/pdfengines/merge',
                headers: form.getHeaders(),
            },
            (response) => {
                if (response.statusCode !== 200) {
                    // ... (no changes here) ...
                    return;
                }
                
                res.setHeader('Content-Type', 'application/pdf');
                res.setHeader('Content-Disposition', 'attachment; filename=merged-result.pdf');
                response.pipe(res);
                
                res.on('finish', cleanupFiles);
            }
        );
        
        request.on('error', (err) => { /* ... (no changes here) ... */ });
        
        form.pipe(request);

    } catch (error) { /* ... (no changes here) ... */ }
});

app.listen(port, () => {
  console.log(`Server is running and listening on http://localhost:${port}`);
});

// We need to re-add the cleanup function here for completeness
const cleanupFilesForPost = (files) => {
    for (const file of files) {
        fs.unlink(file.path, (err) => {
            if (err) console.error('Error deleting temp file:', err);
        });
    }
};

// Final complete code:
const finalApp = express();
const finalUpload = multer({ dest: 'uploads/' });

finalApp.use(express.static('public'));

finalApp.post('/merge', finalUpload.array('files'), (req, res) => {
    
    const cleanup = () => cleanupFilesForPost(req.files);

    try {
        const form = new FormData();
        for (const file of req.files) {
            form.append('files', fs.createReadStream(file.path), { filename: file.originalname });
        }
        
        const request = http.request(
            {
                method: 'POST',
                host: '127.0.0.1',
                port: 3000,
                path: '/forms/pdfengines/merge',
                headers: form.getHeaders(),
            },
            (response) => {
                if (response.statusCode !== 200) {
                    console.error(`Gotenberg returned an error: ${response.statusCode}`);
                    response.on('data', (chunk) => console.error('Gotenberg error message:', chunk.toString()));
                    res.status(500).send('Sorry, Gotenberg could not process the files.');
                    cleanup();
                    return;
                }
                
                res.setHeader('Content-Type', 'application/pdf');
                res.setHeader('Content-Disposition', 'attachment; filename=merged-result.pdf');
                response.pipe(res);
                
                res.on('finish', cleanup);
            }
        );
        
        request.on('error', (err) => {
            console.error('Network error connecting to Gotenberg:', err.message);
            res.status(500).send('Could not connect to the Gotenberg service.');
            cleanup();
        });
        
        form.pipe(request);

    } catch (error) {
        console.error('An unexpected error occurred:', error.message);
        res.status(500).send('An unexpected error occurred on the server.');
        cleanup();
    }
});

finalApp.listen(port, () => {
  console.log(`Server is running and listening on http://localhost:${port}`);
});