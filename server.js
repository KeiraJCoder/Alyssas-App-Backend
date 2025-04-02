require('dotenv').config();
const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const session = require('express-session');
const bodyParser = require('body-parser');
const app = express();
const cors = require('cors');

app.use(cors({ origin: 'http://127.0.0.1:5500' }));

// Setup storage for image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + '-' + file.originalname;
    cb(null, uniqueName);
  }
});
const upload = multer({ storage });

// Middleware
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(session({
  secret: 'your-secret-key',
  resave: false,
  saveUninitialized: false
}));

// Simple login middleware
function requireLogin(req, res, next) {
  if (req.session && req.session.loggedIn) {
    next();
  } else {
    res.redirect('/login');
  }
}

// Handle responses.json safely
const DATA_FILE = path.join(__dirname, 'responses.json');
function loadResponses() {
  try {
    if (!fs.existsSync(DATA_FILE)) return {};
    const content = fs.readFileSync(DATA_FILE, 'utf8');
    return content.trim() ? JSON.parse(content) : {};
  } catch (err) {
    console.error('Failed to read responses.json:', err);
    return {};
  }
}

// Routes
app.get('/login', (req, res) => {
  res.send(`
    <form method="POST" action="/login" style="text-align:center;margin-top:50px;">
      <h2>Login</h2>
      <input name="username" placeholder="Username" required /> <br><br>
      <input type="password" name="password" placeholder="Password" required /> <br><br>
      <button type="submit">Login</button>
    </form>
  `);
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (username === process.env.ADMIN_USER && password === process.env.ADMIN_PASS) {
    req.session.loggedIn = true;
    res.redirect('/view');
  } else {
    res.send('<p>Login failed. <a href="/login">Try again</a></p>');
  }
});

  app.get('/download-answers', requireLogin, (req, res) => {
    const filePath = path.resolve(DATA_FILE);
    if (!fs.existsSync(filePath)) {
      return res.status(404).send('No data found to download.');
    }
    res.download(filePath, 'alyssa-responses.json');
  });

  app.post('/delete-all', requireLogin, (req, res) => {
    try {
      fs.writeFileSync(DATA_FILE, JSON.stringify({}, null, 2));
      res.send('<h3 style="text-align:center;color:red;">✅ All responses deleted.</h3><p style="text-align:center;"><a href="/view">Back to responses</a></p>');
    } catch (err) {
      console.error('Failed to delete responses:', err);
      res.status(500).send('Failed to delete responses.');
    }
  });
  

// Conditional multer middleware
function conditionalUpload(req, res, next) {
  const contentType = req.headers['content-type'];
  if (contentType && contentType.includes('multipart/form-data')) {
    upload.fields([
      { name: 'photo', maxCount: 1 },
      { name: 'drawing', maxCount: 5 }
    ])(req, res, next);
  } else {
    next();
  }
}

// Handle submission
app.post('/submit', conditionalUpload, (req, res) => {
  const { sectionId, response, drawing } = req.body;
  let finalData = {};

  try {
    finalData = typeof response === 'string' ? JSON.parse(response) : response;
  } catch (err) {
    console.error('Failed to parse response:', err);
    return res.status(400).json({ error: 'Invalid JSON in response field.' });
  }

  const allData = loadResponses();
  const today = new Date().toISOString().split('T')[0];
  if (!allData[today]) allData[today] = {};

  if (req.files?.photo?.length && sectionId === 'show-tell') {
    const imageUrl = `/uploads/${req.files.photo[0].filename}`;
    if (!allData[today][sectionId]) allData[today][sectionId] = {};
    if (!allData[today][sectionId].imageHistory) allData[today][sectionId].imageHistory = [];
    allData[today][sectionId].imageHistory.push(imageUrl);
    if (finalData.text) allData[today][sectionId].text = finalData.text;
    fs.writeFileSync(DATA_FILE, JSON.stringify(allData, null, 2));
    return res.status(200).json({ status: 'ok' });
  }

  if (drawing && sectionId === 'drawing') {
    try {
      const drawingBuffer = Buffer.from(drawing.replace(/^data:image\/png;base64,/, ''), 'base64');
      const filename = `drawing-${Date.now()}.png`;
      const filepath = path.join(__dirname, 'uploads', filename);
      fs.writeFileSync(filepath, drawingBuffer);
      const url = `/uploads/${filename}`;

      if (!allData[today]['drawing']) allData[today]['drawing'] = {};
      if (!allData[today]['drawing'].imageUrls) allData[today]['drawing'].imageUrls = [];
      if (allData[today]['drawing'].imageUrls.length < 5) {
        allData[today]['drawing'].imageUrls.push(url);
      }
      fs.writeFileSync(DATA_FILE, JSON.stringify(allData, null, 2));
      return res.status(200).json({ status: 'ok' });
    } catch (err) {
      console.error('Drawing base64 upload error:', err);
      return res.status(500).json({ error: 'Drawing save failed.' });
    }
  }

  if (Array.isArray(finalData)) {
    if (!Array.isArray(allData[today][sectionId])) {
      allData[today][sectionId] = [];
    }
    allData[today][sectionId].push(...finalData);
  
    // ✅ Sort by timestamp descending (most recent first)
    allData[today][sectionId].sort((a, b) => {
      return new Date(b.timestamp || 0) - new Date(a.timestamp || 0);
    });
  } else {
    if (!allData[today][sectionId]) allData[today][sectionId] = {};
    Object.assign(allData[today][sectionId], finalData);
  }
  
  fs.writeFileSync(DATA_FILE, JSON.stringify(allData, null, 2));
  res.status(200).json({ status: 'ok'});

});

// View responses
app.get('/view', requireLogin, (req, res) => {
    const allData = loadResponses();
    if (!Object.keys(allData).length) return res.send('<h2>No responses yet.</h2>');
  
    let html = `
      <style>
        body { 
          font-family: sans-serif; 
          padding: 20px; 
          background: #f9f9ff; 
          color: #333; 
          text-align: center;
        }
        h2 { 
          text-transform: uppercase; 
          color: #444; 
        }
        h3 { 
          margin-top: 30px; 
          text-transform: uppercase; 
          color: #555; 
        }
        .response-section {
          max-width: 600px;
          margin: 20px auto;
          background: #fff;
          padding: 15px;
          border: 1px solid #ddd;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          text-align: center;
        }
        .response-section h4 {
          margin-top: 0;
          text-transform: uppercase;
          color: #333;
        }
        .response-section p, .response-section ul {
          margin: 10px 0;
        }
        .response-section ul {
          list-style: none;
          padding: 0;
        }
        .response-section li {
          margin-bottom: 6px;
          padding: 6px;
          border-bottom: 1px solid #eee;
        }
        .response-section li:last-child {
          border-bottom: none;
        }
        img {
          margin: 5px;
          border-radius: 8px;
          border: 1px solid #ccc;
          max-width: 120px;
          height: auto;
          display: inline-block;
        }
        .btn-bar {
          text-align: center; 
          margin: 20px 0;
        }
        .btn-bar button {
          background: #d33; 
          color: #fff; 
          padding: 10px 20px; 
          border: none; 
          border-radius: 5px; 
          cursor: pointer;
          margin: 0 10px;
          font-size: 16px;
        }
        .btn-bar button.download {
          background: #4CAF50;
        }
      </style>
      <h2>Alyssa's Responses</h2>
      <div class="btn-bar">
        <form action="/delete-all" method="POST" style="display:inline;" onsubmit="return confirm('Are you sure you want to delete all responses?');">
          <button type="submit">🗑️ Delete All Responses</button>
        </form>
        <form action="/download-answers" method="GET" style="display:inline;">
          <button type="submit" class="download">💾 Download All Answers</button>
        </form>
      </div>
    `;
  
    // Sort dates newest first
    const sortedDates = Object.keys(allData).sort((a, b) => new Date(b) - new Date(a));
    sortedDates.forEach(date => {
      html += `<h3>${date}</h3>`;
      const dateData = allData[date];
  
      // Mood Check Section
      if (dateData['mood-check']) {
        let mood = dateData['mood-check'];
        // If mood is an object, try to extract its "text" property.
        if (typeof mood === 'object' && mood !== null) {
          mood = mood.text || JSON.stringify(mood);
        }
        html += `
          <div class="response-section">
            <h4>Mood Check</h4>
            <p>${mood}</p>
          </div>
        `;
      }
  
      // Show & Tell Section
      if (dateData['show-tell']) {
        const st = dateData['show-tell'];
        html += `<div class="response-section">
                    <h4>Show & Tell</h4>`;
        if (st.text) {
          html += `<p><strong>Caption:</strong> ${st.text}</p>`;
        }
        if (Array.isArray(st.imageHistory)) {
          st.imageHistory.forEach(url => {
            html += `<img src="${url}" alt="Show & Tell Image" />`;
          });
        }
        html += `</div>`;
      }
  
      // Question Spinner Section
      if (Array.isArray(dateData['question-spinner'])) {
        const qList = dateData['question-spinner'];
        html += `<div class="response-section">
                    <h4>Question Spinner Answers</h4>
                    <ul>`;
        qList.forEach(item => {
          html += `<li>
                      <strong>Q:</strong> ${item.question}<br>
                      <strong>A:</strong> ${item.answer}
                   </li>`;
        });
        html += `</ul></div>`;
      }
  
      // Activity Choice Section
      if (Array.isArray(dateData['activity-choice'])) {
        html += `<div class="response-section">
                    <h4>Activity Choice</h4>
                    <ul>`;
        dateData['activity-choice'].forEach(item => {
          html += `<li>${item.activity}</li>`;
        });
        html += `</ul></div>`;
      }
  
      // Drawings Section
      if (dateData['drawing'] && Array.isArray(dateData['drawing'].imageUrls)) {
        html += `<div class="response-section">
                    <h4>Drawings</h4>`;
        dateData['drawing'].imageUrls.forEach(url => {
          html += `<img src="${url}" alt="Drawing" />`;
        });
        html += `</div>`;
      }
    });
  
    res.send(html);
  });
  
  

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Call Companion backend running on http://localhost:${PORT}`));