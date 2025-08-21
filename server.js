require('dotenv').config();
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const OpenAI = require('openai');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Debug route to test if server is working
app.get('/test', (req, res) => {
  res.json({ message: 'Server is working!', timestamp: new Date().toISOString() });
});

// Simple HTML test route
app.get('/simple', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head><title>Test</title></head>
    <body>
      <h1>Simple Test Page</h1>
      <p>If you can see this, the server is working!</p>
      <p>Time: ${new Date().toISOString()}</p>
    </body>
    </html>
  `);
});

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Initialize SQLite database
const db = new sqlite3.Database('./production.db');

// Create tables
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS production_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      type TEXT,
      good_parts INTEGER,
      scrap_parts INTEGER,
      reject_parts INTEGER,
      total_parts INTEGER,
      shift TEXT,
      operator TEXT,
      notes TEXT
    )
  `);
  
  db.run(`
    CREATE TABLE IF NOT EXISTS blade_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      coil_count INTEGER,
      total_length_ft DECIMAL,
      blades_cut INTEGER,
      material_cost DECIMAL,
      operator TEXT,
      coil_ids TEXT
    )
  `);
});

// Upload handler
const upload = multer({ dest: 'uploads/' });

// Claude Vision API extraction
async function extractFromEngelScreen(imagePath) {
  try {
    const imageBuffer = fs.readFileSync(imagePath);async function extractFromEngelScreen(imagePath) {
      try {
        const imageBuffer = fs.readFileSync(imagePath);
        const base64Image = imageBuffer.toString('base64');
        
        console.log('Sending image to OpenAI, base64 length:', base64Image.length);
        
        const response = await openai.chat.completions.create({
          model: "gpt-4o",
          max_tokens: 1000,
          messages: [{
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: {
                  url: `data:image/jpeg;base64,${base64Image}`
                }
              },
              {
                type: "text",
                text: `Extract any production numbers visible on this injection molding machine screen.
                       Look for:
                       - Good parts / Accepted parts / OK parts (any production count)
                       - Reject parts / Scrap / NG parts
                       - Total parts / Total production
                       
                       If you can see ANY numbers on the screen, extract them.
                       
                       Return ONLY valid JSON: {"good_parts": number, "scrap_parts": number, "reject_parts": number, "total_parts": number}
                       
                       If a value is not visible, use 0.`
              }
            ]
          }]
        });
        
        const extractedText = response.choices[0].message.content;
        console.log('OpenAI response:', extractedText);
        
        // Clean the response (remove markdown if any)
        const cleanedText = extractedText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const parsed = JSON.parse(cleanedText);
        
        console.log('Parsed data:', parsed);
        return parsed;
        
      } catch (error) {
        console.error('OpenAI extraction error:', error);
        console.error('Error details:', error.message);
        
        // Don't return fallback - return the actual error
        throw error;
      }
    }

async function extractFromCoilLabels(imagePath) {
  try {
    const imageBuffer = fs.readFileSync(imagePath);
    const base64Image = imageBuffer.toString('base64');
    
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 1000,
      messages: [{
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: {
              url: `data:image/jpeg;base64,${base64Image}`
            }
          },
          {
            type: "text",
            text: `Extract from these steel coil labels:
                   1. Number of coil boxes/labels visible
                   2. Coil IDs (the alphanumeric codes)
                   3. Length of each coil (look for measurements in feet)
                   4. Total length (sum of all coils)
                   
                   Return ONLY valid JSON: {"coil_count": number, "total_length": number, "coil_ids": ["id1", "id2"], "estimated_blades": number}`
          }
        ]
      }]
    });
    
    const extractedText = response.choices[0].message.content;
    const data = JSON.parse(extractedText);
    data.estimated_blades = Math.floor(data.total_length * 4.4); // ~4.4 blades per foot
    return data;
  } catch (error) {
    console.error('OpenAI extraction error:', error);
    // Fallback to mock data
    return {
      coil_count: 2,
      total_length: 546,
      coil_ids: ['5114FLC12127', '5114FLC12127'],
      estimated_blades: 2400
    };
  }
}

// API Endpoints
app.post('/api/engel/capture', upload.single('photo'), async (req, res) => {
  try {
    console.log('Processing image:', req.file.originalname);
    const extracted = await extractFromEngelScreen(req.file.path);
    
    // ... rest of your database code ...
    
  } catch (error) {
    console.error('Capture error:', error);
    
    // Clean up file even on error
    if (req.file && req.file.path) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).json({ 
      success: false, 
      error: error.message,
      details: 'Failed to extract data from image'
    });
  }
});

app.post('/api/blade/capture', upload.single('photo'), async (req, res) => {
  try {
    const extracted = await extractFromCoilLabels(req.file.path);
    
    db.run(
      `INSERT INTO blade_log (coil_count, total_length_ft, blades_cut, material_cost, operator, coil_ids) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [extracted.coil_count, extracted.total_length, extracted.estimated_blades,
       extracted.coil_count * 125, req.body.operator || 'Unknown', 
       JSON.stringify(extracted.coil_ids)],
      function(err) {
        if (err) throw err;
        
        // Clean up uploaded file
        fs.unlinkSync(req.file.path);
        
        res.json({ 
          success: true, 
          id: this.lastID,
          data: extracted 
        });
      }
    );
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/summary/today', (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  
  db.all(
    `SELECT 
      COALESCE(SUM(good_parts), 0) as total_good,
      COALESCE(SUM(reject_parts), 0) as total_rejects,
      COUNT(*) as run_count
     FROM production_log 
     WHERE DATE(timestamp) = DATE('now', 'localtime')`,
    (err, production) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      
      db.all(
        `SELECT 
          COALESCE(SUM(blades_cut), 0) as total_blades,
          COALESCE(SUM(total_length_ft), 0) as total_steel
         FROM blade_log 
         WHERE DATE(timestamp) = DATE('now', 'localtime')`,
        (err, blade) => {
          if (err) {
            return res.status(500).json({ error: err.message });
          }
          
          res.json({
            production: production[0],
            blade: blade[0],
            date: today
          });
        }
      );
    }
  );
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Production logger ready on http://0.0.0.0:${PORT}`);
    console.log(`OpenAI API Key: ${process.env.OPENAI_API_KEY ? 'Configured ✓' : 'Missing ✗'}`);
});