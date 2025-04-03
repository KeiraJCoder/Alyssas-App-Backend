require('dotenv').config();
const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const session = require('express-session');
const bodyParser = require('body-parser');
const app = express();
const cors = require('cors');

app.use(cors({
  origin: ['https://keirajcoder.github.io', 'http://127.0.0.1:5500']
}));

// Serve static files (including sounds and images) from 'public/assets'
app.use('/static', express.static(path.join(__dirname, 'public')));

// Serve uploaded files from the 'uploads' directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

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
// Serve app files only after login
app.use('/static', requireLogin, express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: 'your-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 15 * 60 * 1000 // ⏱ 15 minutes in milliseconds
  }
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
  const error = req.query.error === '1';

  res.send(`
    <style>
      body {
        font-family: 'Comic Sans MS', 'Poppins', sans-serif;
        background: linear-gradient(to right, #ffd6f6, #d6f0ff);
        display: flex;
        align-items: center;
        justify-content: center;
        height: 100vh;
        margin: 0;
      }

      .login-box {
        background: #fff8fd;
        padding: 30px;
        border-radius: 16px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        width: 100%;
        max-width: 380px;
        text-align: center;
        border: 2px dashed #ffaadd;
      }

      .login-box h2 {
        margin-bottom: 10px;
        font-size: 1.8rem;
        color: #d63384;
        text-shadow: 1px 1px 0 #fff;
      }

      .login-box small {
        display: block;
        margin-bottom: 20px;
        color: #666;
        font-size: 0.95rem;
      }

      .login-box input {
        width: 100%;
        padding: 10px;
        margin: 10px 0;
        border: 2px solid #ccc;
        border-radius: 10px;
        font-size: 16px;
        background: #fff;
      }

      .password-wrapper {
        position: relative;
      }

      .toggle-password {
        position: absolute;
        right: 12px;
        top: 50%;
        transform: translateY(-50%);
        cursor: pointer;
        font-size: 18px;
        user-select: none;
        color: #888;
      }

      .login-box button {
        width: 100%;
        padding: 12px;
        background: #f78bd0;
        color: white;
        border: none;
        border-radius: 30px;
        font-size: 16px;
        cursor: pointer;
        transition: background 0.3s ease, transform 0.1s ease;
      }

      .login-box button:hover {
        background: #ff6ac1;
        transform: scale(1.03);
      }

      .login-box button:active {
        transform: scale(0.97);
      }

      .error-message {
        color: red;
        margin-top: 12px;
        font-weight: bold;
      }
    </style>


    <div class="login-box">
      <h2>🌟 Welcome, Alyssa! 🌟</h2>
      <small>Enter your magical name and secret password</small>
      <form method="POST" action="/login">
        <input name="username" placeholder="Your Name" required />
        <div class="password-wrapper">
          <input type="password" id="passwordInput" name="password" placeholder="Your Password" required />
          <span class="toggle-password" onclick="togglePassword()">👁️</span>
        </div>
        <button type="submit">✨ Enter My World ✨</button>
      </form>
      ${error ? `<div class="error-message">❌ Oops! Try again, magic one.</div>` : ''}
    </div>


    <script>
      function togglePassword() {
        const input = document.getElementById('passwordInput');
        input.type = input.type === 'password' ? 'text' : 'password';
      }
    </script>
  `);
});

// POST /login route – processes the login submission
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  // If the admin logs in using the env variables:
  if (username === process.env.ADMIN_USER && password === process.env.ADMIN_PASS) {
    req.session.loggedIn = true;
    req.session.isAdmin = true;
    return res.redirect('/view'); // Admin is sent to the backend view
  }
  // If the regular user (Alyssa) logs in using her env variables:
  if (username === process.env.USER_USER && password === process.env.USER_PASS) {
    req.session.loggedIn = true;
    req.session.isAdmin = false;
    return res.redirect('/'); // Alyssa is sent to the frontend view
  }
  // If credentials do not match, redirect back with an error
  return res.redirect('/login?error=1');
});

// Logout route remains the same
app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login');
  });
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

  console.log('✏️ Drawing submitted', { sectionId, drawingLength: drawing?.length });
  if (drawing && sectionId === 'drawing') {
    try {
      const drawingBuffer = Buffer.from(drawing.replace(/^data:image\/png;base64,/, ''), 'base64');
      const filename = `drawing-${Date.now()}.jpg`;
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
            html += `<a href="${url}" download><img src="${url}" alt="Show & Tell Image" title="Click to view/download" /></a>`;
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
          html += `<a href="${url}" target="_blank" download><img src="${url}" alt="Drawing" title="Click to view/download" /></a>`;

        });
        html += `</div>`;
      }
    });

    html += `
      <div id="lightboxOverlay" style="display:none; position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.85); z-index:9999; justify-content:center; align-items:center;">
        <div style="text-align:center;">
          <img id="lightboxImage" src="" style="max-width:90vw; max-height:80vh; border:4px solid white; border-radius:10px; box-shadow:0 0 20px black;" />
          <br />
          <a id="lightboxDownload" href="#" download style="display:inline-block; margin-top:10px; font-size:18px; color:white; background:#4CAF50; padding:10px 20px; border-radius:5px; text-decoration:none;">Download Image</a>
        </div>
      </div>

      <script>
        document.addEventListener('DOMContentLoaded', () => {
          const overlay = document.getElementById('lightboxOverlay');
          const lightboxImage = document.getElementById('lightboxImage');
          const downloadBtn = document.getElementById('lightboxDownload');

          document.querySelectorAll('.response-section img').forEach(img => {
            img.addEventListener('click', (e) => {
              e.preventDefault();
              lightboxImage.src = img.src;
              downloadBtn.href = img.src;
              overlay.style.display = 'flex';
            });
          });

          overlay.addEventListener('click', (e) => {
            if (e.target === overlay || e.target === lightboxImage) {
              overlay.style.display = 'none';
            }
          });
        });
      </script>
    `;

  
    res.send(html);
  });
  
  
// Serve the main app after login
app.get('/', requireLogin, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Call Companion backend running on http://localhost:${PORT}`));