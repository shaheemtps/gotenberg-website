const express = require('express');
const multer = require('multer');
const fs = require('fs');
const FormData = require('form-data');
const http = require('http'); // We can keep using http for simplicity
const https = require('https'); // We might need this for https requests

const app = express();
const port = 4000;
const upload = multer({ dest: 'uploads/' });

app.use(express.static('public'));

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

        console.log('Sending files to the LIVE Gotenberg service on Fly.io...');

        // <<<<<<<<<<<< THE MOST IMPORTANT CHANGE IS HERE >>>>>>>>>>>>
        // We are now pointing to our live Gotenberg engine on the internet.
        const gotenbergUrl = 'https://shaheem-gotenberg.fly.dev/forms/pdfengines/merge';
        
        // We create a request using the native https module since the URL is https
        const request = https.request(
            gotenbergUrl,
            {
                method: 'POST',
                headers: form.getHeaders(),
            },
            (response) => {
                if (response.statusCode !== 200) {
                    console.error(`Gotenberg returned an error: ${response.statusCode}`);
                    response.on('data', (chunk) => console.error('Gotenberg error message:', chunk.toString()));
                    res.status(500).send('Sorry, Gotenberg could not process the files.');
                    cleanupFiles();
                    return;
                }
                
                res.setHeader('Content-Type', 'application/pdf');
                res.setHeader('Content-Disposition', 'attachment; filename=merged-result.pdf');
                response.pipe(res);
                console.log('Successfully sent merged PDF to user.');

                res.on('finish', cleanupFiles);
            }
        );
        
        request.on('error', (err) => {
            console.error('Network error connecting to Gotenberg:', err.message);
            res.status(500).send('Could not connect to the Gotenberg service.');
            cleanupFiles();
        });
        
        form.pipe(request);

    } catch (error) {
        console.error('An unexpected error occurred in the /merge route:', error.message);
        res.status(500).send('An unexpected error occurred on the server.');
        cleanupFiles();
    }
});

// A small change is needed for Render deployment
// Render provides a PORT environment variable. We should use that.
// If it doesn't exist (like on our local computer), we fall back to 4000.
const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`Server is running and listening on port ${PORT}`);
});