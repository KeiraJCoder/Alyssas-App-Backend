/* ===============================
   Global Variables & Constants
   =============================== */

// Import question data from external file for cleaner structure
import { QUESTION_DB } from './questionData.js';

const TOPICS = Object.keys(QUESTION_DB);

let erasing = false;
let penSize = 3;
let selectedColour = '#000000'; // initial pen colour
let questionAnswers = JSON.parse(localStorage.getItem("question-spinner-answers") || "[]");
let currentQuestion = '';
let selectedActivities = [];
let stars = 0;
let defaultCanvasSize = { width: 600, height: 300 };
let uploadedImageBase64 = "";
let angle = 0;
let spinning = false;
let today = new Date().toISOString().split('T')[0];
let drawingControls = null;
let shownQuestions = new Set(JSON.parse(localStorage.getItem(`shownQuestions_${today}`) || '[]'));
let usedTopics = new Set(JSON.parse(localStorage.getItem(`usedTopics_${today}`) || '[]'));


/* ===============================
   Daily Topics Logic
   =============================== */

function getDailyTopics() {
  const dailyKey = `dailyTopics_${today}`;
  let dailyTopics = localStorage.getItem(dailyKey);
  if (dailyTopics) {
    return JSON.parse(dailyTopics);
  } else {
    const DAILY_TOPIC_COUNT = Math.min(7, TOPICS.length);
    const shuffledTopics = TOPICS.slice().sort(() => Math.random() - 0.5);
    const selectedTopics = shuffledTopics.slice(0, DAILY_TOPIC_COUNT);
    dailyTopics = selectedTopics.map(topic => {
      const questions = QUESTION_DB[topic];
      const randomIndex = Math.floor(Math.random() * questions.length);
      return { topic: topic, question: questions[randomIndex] };
    });
    localStorage.setItem(dailyKey, JSON.stringify(dailyTopics));
    return dailyTopics;
  }
}

function saveDailyTopics(dailyTopics) {
  const dailyKey = `dailyTopics_${today}`;
  localStorage.setItem(dailyKey, JSON.stringify(dailyTopics));
}

/* ===============================
   Initialization on Window Load
   =============================== */

const storedDate = localStorage.getItem("lastUsedDate");

if (storedDate && storedDate !== today) {
  localStorage.removeItem("earnedStars");
  localStorage.removeItem("callCompanionResponses");
  localStorage.removeItem(`dailyTopics_${storedDate}`);
  localStorage.removeItem("drawingImage");
  localStorage.removeItem("question-spinner-answers");
  localStorage.removeItem("currentQuestion");
  localStorage.removeItem(`skipsRemaining_${today}`);

}

localStorage.setItem("lastUsedDate", today);

const savedAnswers = JSON.parse(localStorage.getItem("question-spinner-answers") || "[]");
if (savedAnswers.length > 0) {
  questionAnswers = savedAnswers;
  renderAnswerList();
}

const savedQuestion = localStorage.getItem("currentQuestion");
if (savedQuestion) {
  currentQuestion = savedQuestion;
  document.getElementById('questionText').textContent = savedQuestion;
}


window.onload = () => {
  initApp();
};

function initApp() {
  updateDrawingCounter();

  // Set default drawing colour
  selectedColour = '#000000';
  penSize = 3;
  erasing = false;

  const penSizeInput = document.getElementById('penSize');
  const eraserBtn = document.getElementById('eraserToggle');

  if (penSizeInput) {
    penSizeInput.addEventListener('input', (e) => {
      penSize = parseInt(e.target.value, 10);
    });
  }

  if (eraserBtn) {
    eraserBtn.addEventListener('click', () => {
      erasing = !erasing;
      eraserBtn.textContent = erasing ? '🩹 Eraser: On' : '🩹 Eraser: Off';
    });
  }


  // 🎨 Normal colour picker
  const normalPicker = document.getElementById('normalColourPicker');
  if (normalPicker) {
    normalPicker.addEventListener('input', (e) => {
      selectedColour = e.target.value;
    });
  }

  // 🌈 Fullscreen swatches
  document.querySelectorAll('.fullscreen-swatches .swatch').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedColour = btn.getAttribute('data-colour');
      document.getElementById('fullscreenColourPicker').value = selectedColour;
    });
  });

  // 🎨 Fullscreen custom colour picker
  const fullscreenPicker = document.getElementById('fullscreenColourPicker');
  if (fullscreenPicker) {
    fullscreenPicker.addEventListener('input', (e) => {
      selectedColour = e.target.value;
    });
  }

  const savedStars = localStorage.getItem("earnedStars");
  if (savedStars) {
    stars = parseInt(savedStars);
    displayStars();
  }

  const savedData = JSON.parse(localStorage.getItem('callCompanionResponses') || '{}');

  if (savedData['mood-check']) {
    const moodCard = document.getElementById('mood-check');
    document.getElementById('selectedMood').textContent = `You picked: ${savedData['mood-check']}`;
    document.querySelector('nav.navigation')?.classList.remove('hidden');
  
    const moodDone = localStorage.getItem(`moodCheckComplete_${today}`) === 'true';
    if (moodDone && moodCard) {
      moodCard.classList.add('hidden'); // ✅ Keep hidden today
    } else {
      moodCard?.classList.add('completed');
    }
  }
  
  if (savedData['activity-choice']) {
    const selectedActivityEl = document.getElementById('selectedActivity');
    const activityCard = document.getElementById('activity-choice');
    const alreadyDone = localStorage.getItem(`activityChoiceComplete_${today}`) === 'true';
  
    const activities = savedData['activity-choice'].map(item => item.activity);
    if (selectedActivityEl) {
      selectedActivityEl.textContent = `You picked: ${activities.join(', ')}`;
    }
  
    const buttons = document.querySelectorAll('.activity-list button');
    buttons.forEach(btn => {
      if (activities.includes(btn.textContent.replace(/^[^a-zA-Z]+/, ''))) {
        btn.classList.add('selected');
      }
    });
  
    activityCard?.classList.add('completed');
    if (alreadyDone) {
      activityCard?.classList.add('hidden');
    }
  }
  
  setupCanvasEvents();
  setupDrawingToggle();
  setupResponseView();
  setupWheel();
  updateShowTellImageCount();
  setupAnswerInput();
  setupImagePreview();


  document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement) closeFullscreen();
  });

  const sendPhotoBtn = document.querySelector('.submit-button');
  if (sendPhotoBtn) {
    sendPhotoBtn.addEventListener('click', submitShowTellImage);
    sendPhotoBtn.removeAttribute('onclick');
  }
}

/* ===============================
    SHOW & TELL: Image Upload & Preview
=============================== */

function setupImagePreview() {
  const photoInput = document.getElementById('photoUpload');
  if (!photoInput) return;

  photoInput.addEventListener('change', function (event) {
    const file = event.target.files[0];
    const previewContainer = document.getElementById('imagePreviewContainer');
    previewContainer.innerHTML = '';

    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = function (e) {
        uploadedImageBase64 = e.target.result;

        const img = document.createElement('img');
        img.src = uploadedImageBase64;
        img.alt = "Preview";
        img.style.maxWidth = '100%';
        img.style.borderRadius = '10px';

        previewContainer.appendChild(img);
      };
      reader.readAsDataURL(file);
    }

    const today = new Date().toISOString().split('T')[0];
    const count = parseInt(localStorage.getItem(`showTellImageCount_${today}`) || '0');
    if (count >= 5) {
      photoInput.disabled = true;
      document.querySelector('.submit-button').disabled = true;
    }
  });
}

function submitShowTellImage(event) {
  event.preventDefault();
  event.stopPropagation();

  const fileInput = document.getElementById('photoUpload');
  const textInput = document.getElementById('showTellInput');
  const previewContainer = document.getElementById('imagePreviewContainer');
  const sendButton = document.querySelector('.submit-button');
  const statusMessage = document.getElementById('showTellCountMessage');

  if (!fileInput?.files?.[0]) {
    alert("Please select a photo to upload!");
    return;
  }

  if (!textInput.value.trim()) {
    alert("Please explain what’s in the picture before sending it.");
    textInput.focus();
    return;
  }

  // ✅ Instant feedback
  playSound('star');
  confetti({
    particleCount: 100,
    spread: 70,
    origin: { y: 0.6 }
  });

  // ✅ Show spinner
  statusMessage.innerHTML = `<span class="loading"></span>Sending photo...`;
  statusMessage.style.color = "black";

  const formData = new FormData();
  formData.append('sectionId', 'show-tell');
  formData.append('response', JSON.stringify({ text: textInput.value }));
  formData.append('photo', fileInput.files[0]);

  fetch('https://alyssas-app-backend.onrender.com/submit', {
    method: 'POST',
    body: formData
  })
    .then(res => {
      if (!res.ok) throw new Error('Server error');
      return res.json();
    })
    .then(() => {
      const today = new Date().toISOString().split('T')[0];
      localStorage.setItem(`showTellImageCount_${today}`, '1');

      fileInput.disabled = true;
      sendButton.disabled = true;

      fileInput.value = "";
      textInput.value = "";
      previewContainer.innerHTML = "";

      // ✅ Success message
      statusMessage.innerHTML = "✅ Photo sent! You can share again tomorrow.";
      statusMessage.style.color = "green";

      // ✅ Award star after success
      stars++;
      localStorage.setItem("earnedStars", stars);
      displayStars();

      completeSection('show-tell');
    })
    .catch(err => {
      console.error("Error uploading photo:", err);
      statusMessage.textContent = "❌ Failed to send photo. Please try again.";
      statusMessage.style.color = "red";
    });
}



function updateShowTellImageCount() {
  const today = new Date().toISOString().split('T')[0];
  const count = parseInt(localStorage.getItem(`showTellImageCount_${today}`) || '0');

  const fileInput = document.getElementById('photoUpload');
  const sendButton = document.querySelector('.submit-button');
  const messageEl = document.getElementById('showTellCountMessage');

  const reachedLimit = count >= 1;

  if (fileInput) fileInput.disabled = reachedLimit;
  if (sendButton) sendButton.disabled = reachedLimit;

  if (messageEl) {
    messageEl.textContent = reachedLimit
      ? "📸 You've already sent a photo today!"
      : '';
    messageEl.style.color = reachedLimit ? "purple" : '';
  }
}

/* ===============================
    COMPLETE SECTION Handler
=============================== */
function completeSection(sectionId) {
  console.log("👉 completeSection called with:", sectionId);

  const section = document.getElementById(sectionId);
  if (!section) {
    console.warn(`⚠️ Section "${sectionId}" not found.`);
    return;
  }

  const today = new Date().toISOString().split('T')[0];
  const existingData = JSON.parse(localStorage.getItem('callCompanionResponses') || '{}');
  let response = null;
  let shouldSend = true;

  if (sectionId === 'question-spinner') {
    section.classList.add('completed');
  } else {
    if (section.classList.contains('completed')) return;
  }

  switch (sectionId) {
    case 'show-tell': {
      // Already handled separately in submitShowTellImage()
      existingData['show-tell-completed'] = true;
      localStorage.setItem(`showTellComplete_${today}`, 'true');
      section.classList.add('hidden');
      shouldSend = false;
      break;
    }

    case 'mood-check': {
      response = document.getElementById('selectedMood')?.textContent || '';
      existingData['mood-check'] = response;
      break;
    }

    case 'question-spinner': {
      document.querySelector('#question-spinner input[type="text"]')?.blur();

      if (!questionAnswers || questionAnswers.length === 0) {
        alert("Please answer at least one question.");
        shouldSend = false;
        break;
      }

      const newResponses = [...questionAnswers];
      const previous = existingData['question-spinner'] || [];
      const appended = previous.concat(newResponses);

      const deduped = appended.filter((entry, idx, arr) =>
        idx === arr.findIndex(e =>
          e.question === entry.question && e.answer === entry.answer
        )
      );

      existingData['question-spinner'] = deduped;
      response = newResponses;

      questionAnswers = [];
      localStorage.setItem("question-spinner-answers", JSON.stringify(questionAnswers));

      const dailyTopics = getDailyTopics();
      if (dailyTopics.length === 0) {
        localStorage.setItem(`questionSpinnerLocked_${today}`, 'true');
        document.getElementById('spinWheel').disabled = true;
        document.getElementById('skipQuestionBtn').disabled = true;
        document.getElementById('questionText').textContent = '🎉 All questions answered today!';
      }

      section.classList.add('hidden');
      break;
    }

    case 'activity-choice': {
      if (selectedActivities.length === 0) {
        alert("Please pick at least one activity!");
        shouldSend = false;
        break;
      }
    
      const activityData = selectedActivities.map(activity => ({ activity }));
      existingData['activity-choice'] = activityData;
      response = activityData;
    
      section.classList.add('hidden');
      localStorage.setItem(`activityChoiceComplete_${today}`, 'true');
    
      // ✅ Reward only after section is completed
      stars++;
      localStorage.setItem("earnedStars", stars);
      displayStars();
      playSound('star');
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });
    
      break;
    }
    
    default:
      shouldSend = false;
      break;
  }

  localStorage.setItem('callCompanionResponses', JSON.stringify(existingData));
  section.classList.add('completed');

  if (shouldSend && response !== null) {
    const wrappedResponse = typeof response === 'string' ? { text: response } : response;

    console.log("📤 Sending to backend:", {
      sectionId,
      response: wrappedResponse
    });

    fetch('https://alyssas-app-backend.onrender.com/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sectionId,
        response: wrappedResponse
      })
    });
  }
}

//   // Award star
//   stars++;
//   localStorage.setItem("earnedStars", stars);
//   displayStars();
//   playSound('star');
// }


/* ===============================
      SPINNER WHEEL Setup
=============================== */

let selectedTopic = null;

function setupWheel() {
  const canvas = document.getElementById("questionWheel");
  const ctx = canvas?.getContext("2d");
  const spinBtn = document.getElementById("spinWheel");
  const skipBtn = document.getElementById("skipQuestionBtn");   // Must match your HTML
  const questionOutput = document.getElementById("questionText");
  const skipsLeftEl = document.getElementById("skipCounter");      // Must match your HTML
  const wheelRadius = canvas?.width / 2;

  if (!canvas || !ctx || !questionOutput || !spinBtn || !skipBtn || !skipsLeftEl) return;
  let dailyTopics = getDailyTopics(); // existing
  window.updateWheelTopics = (newTopics) => {
    dailyTopics = newTopics;
    drawWheel();
  };
  
  angle = 0;
  spinning = false;
  let skipsLeft = 3;

  function drawWheel() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (dailyTopics.length === 0) return;

    const sectionAngle = (2 * Math.PI) / dailyTopics.length;
    const pastelColours = [
      '#FFC1CC', '#FFB5E8', '#FF9CEE', '#B28DFF', '#B5B9FF',
      '#AFCBFF', '#85E3FF', '#AFF8DB', '#C5FFC5', '#FDFFB6'
    ];

    dailyTopics.forEach((item, i) => {
      const startAngle = i * sectionAngle;
      const endAngle = startAngle + sectionAngle;
      const colour = pastelColours[i % pastelColours.length];

      ctx.beginPath();
      ctx.moveTo(wheelRadius, wheelRadius);
      ctx.arc(wheelRadius, wheelRadius, wheelRadius, startAngle, endAngle);
      ctx.fillStyle = colour;
      ctx.fill();
      ctx.strokeStyle = selectedColour;
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.save();
      ctx.translate(wheelRadius, wheelRadius);
      ctx.rotate(startAngle + sectionAngle / 2);
      ctx.textAlign = "right";
      ctx.fillStyle = "#333";
      ctx.font = "14px Comic Sans MS";
      ctx.fillText(item.topic, wheelRadius - 10, 5);
      ctx.restore();
    });

    // Draw center dot
    ctx.beginPath();
    ctx.arc(wheelRadius, wheelRadius, 5, 0, 2 * Math.PI);
    ctx.fillStyle = "#333";
    ctx.fill();
  }

  function updateSkipsLeftDisplay() {
    skipsLeftEl.textContent = `Skips left: ${skipsLeft}`;
  }

  function spinQuestion() {
    if (spinning || dailyTopics.length === 0) return;
    spinning = true;
    playSound('spin');

    const spinDuration = 4500;
    const spins = 4;
    const sectionAngle = (2 * Math.PI) / dailyTopics.length;
    const randomOffset = Math.random() * sectionAngle;
    const finalSpinAngle = spins * 2 * Math.PI + randomOffset;
    const startTime = performance.now();

    function animate(time) {
      const elapsed = time - startTime;
      const progress = Math.min(elapsed / spinDuration, 1);
      const easeOut = 1 - Math.pow(1 - progress, 3);
      angle = easeOut * finalSpinAngle;

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.translate(wheelRadius, wheelRadius);
      ctx.rotate(angle);
      ctx.translate(-wheelRadius, -wheelRadius);
      drawWheel();

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        const normalizedAngle = angle % (2 * Math.PI);
        const pointerAngle = (3 * Math.PI) / 2;
        const adjustedAngle = (pointerAngle - normalizedAngle + 2 * Math.PI) % (2 * Math.PI);
        const index = Math.floor(adjustedAngle / sectionAngle);
        const chosenItem = dailyTopics[index];

        currentQuestion = chosenItem.question;
        selectedTopic = chosenItem.topic;
        localStorage.setItem(`shownQuestions_${today}`, JSON.stringify([...shownQuestions]));
        questionOutput.textContent = `${chosenItem.topic}: ${chosenItem.question}`;
        spinning = false;
      }
    }

    requestAnimationFrame(animate);
  }

  // Updated skipQuestion: Only refresh the current question without removing it
  function skipQuestion() {
    if (spinning || skipsLeft <= 0 || !selectedTopic) return;
  
    skipsLeft--;
    updateSkipsLeftDisplay();
  
    usedTopics.add(selectedTopic);
    localStorage.setItem(`usedTopics_${today}`, JSON.stringify([...usedTopics]));
  
    const unusedTopics = TOPICS.filter(t =>
      !usedTopics.has(t) &&
      !dailyTopics.some(d => d.topic === t)
    );
  
    if (unusedTopics.length === 0) {
      currentQuestion = '';
      questionOutput.textContent = '🎉 No fresh topics left to skip to!';
      return;
    }
  
    const newTopic = unusedTopics[Math.floor(Math.random() * unusedTopics.length)];
    const newQuestion = QUESTION_DB[newTopic][Math.floor(Math.random() * QUESTION_DB[newTopic].length)];
  
    // Replace current topic
    const index = dailyTopics.findIndex(item => item.topic === selectedTopic);
    if (index !== -1) {
      dailyTopics[index] = { topic: newTopic, question: newQuestion };
      saveDailyTopics(dailyTopics);
      if (window.updateWheelTopics) window.updateWheelTopics(dailyTopics);
    }
  
    currentQuestion = newQuestion;
    selectedTopic = newTopic;
    shownQuestions.add(currentQuestion);
    localStorage.setItem(`shownQuestions_${today}`, JSON.stringify([...shownQuestions]));
  
    questionOutput.textContent = `${newTopic}: ${newQuestion}`;
  
    if (skipsLeft <= 0) {
      skipBtn.disabled = true;
    }
  }
  

  spinBtn.addEventListener('click', spinQuestion);
  skipBtn.addEventListener('click', skipQuestion);
  updateSkipsLeftDisplay();
  drawWheel();
}


/* ===============================
  QUESTION ANSWER Input & Display
=============================== */

function setupAnswerInput() {
  const answerInput = document.querySelector('#question-spinner input[type="text"]');
  const answerList = document.getElementById('answerList');

  if (!answerInput || !answerList) return;

  function saveAnswer() {
    const answer = answerInput.value.trim();
    if (!answer || !currentQuestion) return;
  
    const entry = { question: currentQuestion, answer, timestamp: new Date().toISOString() };
    questionAnswers.push(entry);
    localStorage.setItem("question-spinner-answers", JSON.stringify(questionAnswers));
    renderAnswerList();
    answerInput.value = '';
  
    // 🎉 Confetti when answered
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 }
    });
    stars++;
    localStorage.setItem("earnedStars", stars);
    displayStars();
    playSound('star');

  
    // ✅ Track topic as used
    if (selectedTopic) {
      usedTopics.add(selectedTopic);
      localStorage.setItem(`usedTopics_${today}`, JSON.stringify([...usedTopics]));
    }
  
    // ✅ Remove it from dailyTopics (do NOT replace it)
    let dailyTopics = getDailyTopics().filter(item => item.topic !== selectedTopic);
  
    saveDailyTopics(dailyTopics);
    if (window.updateWheelTopics) {
      window.updateWheelTopics(dailyTopics);
    }
  
    currentQuestion = '';
    selectedTopic = null;
  }
  
  
  answerInput.addEventListener('blur', saveAnswer);
  answerInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveAnswer(); // ✅ directly call to preserve selectedTopic
      answerInput.blur(); // optional: if you still want to blur afterwards
    }
  });
}

function renderAnswerList() {
  const list = document.getElementById('answerList');
  if (!list) return;

  list.innerHTML = '';
  questionAnswers.forEach((entry) => {
    const li = document.createElement('li');
    li.textContent = `❓ ${entry.question} – 💬 ${entry.answer}`;
    list.appendChild(li);
  });
}

/* ===============================
   STAR Display, Reset & Drawing Download
=============================== */

// Show current star count
function displayStars() {
  document.getElementById('stars-earned').textContent = '🌟'.repeat(stars);
}

// Reset progress and visuals
function resetProgress() {
  if (!confirm("Reset your stars and sections?")) return;

  stars = 0;
  uploadedImageBase64 = "";
  localStorage.clear();
  const moodCard = document.getElementById('mood-check');
  if (moodCard) moodCard.classList.remove('hidden', 'completed');


  displayStars();

  document.querySelectorAll('.card').forEach(card => {
    card.classList.remove('completed');
    card.style.opacity = 1;
  });

  playSound('reset');
}

// Download drawing as PNG
function downloadDrawing() {
  const canvas = document.getElementById('drawCanvas');
  if (!canvas) return;

  const link = document.createElement('a');
  link.download = 'my-drawing.png';
  link.href = canvas.toDataURL('image/png');
  link.click();
}

   
/* ===============================
   SOUND EFFECTS
=============================== */
function playSound(type) {
  const soundMap = {
    star: '/static/assets/sounds/star.mp3',
    spin: '/static/assets/sounds/spin.mp3',
    reset: '/static/assets/sounds/reset.mp3'
  };

  const soundSrc = soundMap[type];
  if (!soundSrc) return;

  const audio = new Audio(soundSrc);
  audio.play().catch(err => {
    console.warn(`Failed to play sound for type: ${type}`, err);
  });
}

   
/* ===============================
   MOOD & ACTIVITY SELECTORS
=============================== */

function selectMood(mood) {
  const moodDisplay = document.getElementById('selectedMood');
  const nav = document.querySelector('nav.navigation');
  const moodCard = document.getElementById('mood-check');

  if (moodDisplay) moodDisplay.textContent = `You picked: ${mood}`;
  if (nav) nav.classList.remove('hidden');
  if (moodCard) moodCard.classList.add('hidden');

  localStorage.setItem(`moodCheckComplete_${today}`, 'true');

  // ✅ Reward logic
  stars++;
  localStorage.setItem("earnedStars", stars);
  displayStars();
  playSound('star');
  confetti({
    particleCount: 100,
    spread: 70,
    origin: { y: 0.6 }
  });
  

  completeSection('mood-check');
}



function selectActivity(activity, el) {
  // Remove emoji and whitespace from the front of the button label
  const cleaned = activity.replace(/^[^\w]+/, '').trim();

  if (selectedActivities.includes(cleaned)) {
    // Deselect
    selectedActivities = selectedActivities.filter(a => a !== cleaned);
    el.classList.remove('selected');
  } else if (selectedActivities.length < 3) {
    selectedActivities.push(cleaned);
    el.classList.add('selected');
  }

  // Disable unselected buttons if 3 are already picked
  const buttons = document.querySelectorAll('.activity-list button');
  buttons.forEach(btn => {
    const text = btn.textContent.replace(/^[^\w]+/, '').trim();
    if (!selectedActivities.includes(text)) {
      btn.disabled = selectedActivities.length >= 3;
    }
  });

  // Update display
  const selectedActivityEl = document.getElementById('selectedActivity');
  if (selectedActivityEl) {
    selectedActivityEl.textContent = selectedActivities.length
      ? `You've picked: ${selectedActivities.join(', ')}`
      : '';
  }
}


/* ===============================
   DRAWING CANVAS SETUP
=============================== */

function setupDrawingToggle() {
  const drawToggle = document.getElementById('startDrawingButton');
  if (!drawToggle) return;

  drawingControls = document.getElementById('drawingControls');
  if (!drawingControls) return;

  drawToggle.addEventListener('click', () => {
    const isVisible = drawingControls.classList.contains('visible');

    if (isVisible) {
      drawingControls.classList.remove('visible');
      setTimeout(() => {
        drawingControls.style.display = 'none';
      }, 300);
    } else {
      drawingControls.style.display = 'block';
      requestAnimationFrame(() => drawingControls.classList.add('visible'));
    }
  });
}


function setupCanvasEvents() {
  const canvas = document.getElementById('drawCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let drawing = false;

  function getTouchPos(e) {
    const rect = drawCanvas.getBoundingClientRect();
    const touch = e.touches[0];
    return {
      x: touch.clientX - rect.left,
      y: touch.clientY - rect.top
    };
  }
  

  function startDrawing(e) {
    drawing = true;
    if (e.type.startsWith("touch")) {
      e.preventDefault();
      const pos = getTouchPos(e);
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
    }
  }

  function draw(e) {
    if (!drawing) return;
    e.preventDefault();
  
    const rect = canvas.getBoundingClientRect();
    let x, y;
  
    if (e.type.startsWith("touch")) {
      const touch = e.touches[0];
      x = touch.clientX - rect.left;
      y = touch.clientY - rect.top;
    } else {
      x = e.clientX - rect.left;
      y = e.clientY - rect.top;
    }
  
    // Scale coordinates based on canvas resolution
    x *= canvas.width / rect.width;
    y *= canvas.height / rect.height;
  
    ctx.lineWidth = penSize;
    ctx.lineCap = 'round';
    ctx.strokeStyle = erasing ? '#ffffff' : selectedColour;
  
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y);
  }
  

  function stopDrawing(e) {
    drawing = false;
    ctx.beginPath();
  }

  // Mouse events
  canvas.addEventListener('mousedown', startDrawing);
  canvas.addEventListener('mousemove', draw);
  canvas.addEventListener('mouseup', stopDrawing);
  canvas.addEventListener('mouseout', stopDrawing);

  // Touch events
  canvas.addEventListener('touchstart', startDrawing, { passive: false });
  canvas.addEventListener('touchmove', draw, { passive: false });
  canvas.addEventListener('touchend', stopDrawing);
}

function clearCanvas() {
  const canvas = document.getElementById('drawCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

/* ===============================
   FULLSCREEN CONTROLS
=============================== */

function openFullscreen() {
  const container = document.getElementById('drawing-section');
  const canvas = document.getElementById('drawCanvas');
  if (!container?.requestFullscreen) return alert("Fullscreen not supported");

  container.requestFullscreen().then(() => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;


    document.querySelector('.colour-picker-wrapper').classList.add('hidden');
    document.querySelector('.fullscreen-swatches')?.classList.remove('hidden');
    document.querySelector('.fullscreen-picker-row')?.classList.remove('hidden');
    

    const fullscreenBtn = document.getElementById('fullscreenToggleButton');
    if (fullscreenBtn) {
      fullscreenBtn.innerText = '❌ Exit Fullscreen';
      fullscreenBtn.onclick = closeFullscreen;
    }

    window.addEventListener('resize', resizeCanvasFullscreen);
  });
}


function closeFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen();


  document.querySelector('.colour-picker-wrapper').classList.remove('hidden');
  document.querySelector('.fullscreen-swatches')?.classList.add('hidden');
  document.querySelector('.fullscreen-picker-row')?.classList.add('hidden');
  

  const fullscreenBtn = document.getElementById('fullscreenToggleButton');
  if (fullscreenBtn) {
    fullscreenBtn.innerText = '🖼 Fullscreen';
    fullscreenBtn.onclick = openFullscreen;
  }

  const canvas = document.getElementById('drawCanvas');
  if (canvas) {
    canvas.width = defaultCanvasSize.width;
    canvas.height = defaultCanvasSize.height;
  }

  window.removeEventListener('resize', resizeCanvasFullscreen);
}



function resizeCanvasFullscreen() {
  const canvas = document.getElementById('drawCanvas');
  if (document.fullscreenElement && canvas) {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
}

/* ===============================
   DRAWING COUNTER & SUBMIT LOGIC
=============================== */

function updateDrawingCounter() {
  const counterEl = document.getElementById('drawingCounter');
  const submitButton = document.getElementById('submitDrawingBtn');
  const today = new Date().toISOString().split('T')[0];
  const drawingCount = parseInt(localStorage.getItem(`drawingCount_${today}`) || '0');
  const remaining = 5 - drawingCount;

  if (remaining > 0) {
    counterEl.textContent = `🎨 You can still send ${remaining} more drawing${remaining > 1 ? 's' : ''} today.`;
    counterEl.style.color = 'teal';
    submitButton.disabled = false;
    submitButton.style.opacity = '1';
  } else {
    counterEl.textContent = "🎉 You've submitted all 5 drawings today!";
    counterEl.style.color = 'purple';
    submitButton.disabled = true;
    submitButton.style.opacity = '0.5';
  }
}

async function submitDrawing(event) {
  event.preventDefault();
  event.stopPropagation();

  const canvas = document.getElementById('drawCanvas');
  const statusEl = document.getElementById('drawingStatus');
  const submitButton = document.getElementById('submitDrawingBtn');

  if (!canvas || !statusEl || !submitButton) {
    console.error("Missing elements for drawing submission.");
    return;
  }

  const ctx = canvas.getContext('2d');
  const today = new Date().toISOString().split('T')[0];
  const drawingKey = `drawingCount_${today}`;
  let drawingCount = parseInt(localStorage.getItem(drawingKey) || '0');

  if (drawingCount >= 5) {
    statusEl.textContent = "🎉 You've already submitted 5 amazing drawings today!";
    statusEl.style.color = "purple";
    submitButton.disabled = true;
    submitButton.style.opacity = '0.5';
    return;
  }

  const base64Image = canvas.toDataURL('image/jpg');

  // ✅ Visual feedback while sending
  statusEl.innerHTML = `<span class="loading"></span> Sending drawing...`;
  statusEl.style.color = "black";
  submitButton.disabled = true;
  submitButton.style.opacity = '0.5';

  try {
    const res = await fetch('https://alyssas-app-backend.onrender.com/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sectionId: 'drawing',
        drawing: base64Image
      })
    });

    if (!res.ok) throw new Error("Server error");

    // ✅ Award star on success
    stars++;
    localStorage.setItem("earnedStars", stars);
    displayStars();
    playSound('star');

    // ✅ Confetti 🎉
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 }
    });

    drawingCount++;
    localStorage.setItem(drawingKey, drawingCount);
    updateDrawingCounter();
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (drawingCount >= 5) {
      statusEl.textContent = "🎉 That's 5 drawings today — you're on fire! 🔥";
      statusEl.style.color = "purple";
      submitButton.disabled = true;
      submitButton.style.opacity = '0.5';
    } else {
      statusEl.textContent = `✅ Drawing ${drawingCount}/5 sent! Keep going if you want!`;
      statusEl.style.color = "green";
      submitButton.disabled = false;
      submitButton.style.opacity = '1';
    }

  } catch (err) {
    console.error('Error uploading drawing:', err);
    statusEl.textContent = "❌ Something went wrong submitting your drawing.";
    statusEl.style.color = "red";
    submitButton.disabled = false;
    submitButton.style.opacity = '1';
  }
}

/* ===============================
   VIEW RESPONSES Setup
=============================== */
function setupResponseView() {
  const viewBtn = document.getElementById('viewResponses');
  const summaryBox = document.getElementById('responseSummary');
  const responseData = document.getElementById('responseData');

  if (!viewBtn || !summaryBox || !responseData) return;

  viewBtn.addEventListener('click', () => {
    const isHidden = summaryBox.style.display === 'none';
    summaryBox.style.display = isHidden ? 'block' : 'none';

    const data = JSON.parse(localStorage.getItem('callCompanionResponses') || '{}');
    responseData.textContent = JSON.stringify(data, null, 2);
  });
}

/* ===============================
   RESET DAILY FIELDS
=============================== */
function resetDailyFields() {
  const today = new Date().toISOString().split('T')[0];

  // Remove keys that mark sections as completed for today
  const keysToRemove = [
    `usedQuestions_${today}`,
    'callCompanionResponses',
    `dailyTopics_${today}`,
    'question-spinner-answers',
    'currentQuestion',
    `shownQuestions_${today}`,
    'drawingImage',
    `showTellImageCount_${today}`,
    `drawingCount_${today}`,
    `moodCheckComplete_${today}`,
    `activityChoiceComplete_${today}`,
    `showTellComplete_${today}`,
    `skipsRemaining_${today}`
  ];
  keysToRemove.forEach(key => localStorage.removeItem(key));

  // Reset stars
  stars = 0;
  localStorage.setItem("earnedStars", stars);
  displayStars();

  // Reset in-memory variables
  questionAnswers = [];
  currentQuestion = '';
  selectedActivities = [];

  // Reset all UI cards: remove hidden/completed classes and reset content
  document.querySelectorAll('.card').forEach(card => {
    card.classList.remove('completed', 'hidden');
    card.style.opacity = 1;

    card.querySelectorAll('input').forEach(input => (input.value = ''));
    card.querySelectorAll('#imagePreviewContainer').forEach(preview => (preview.innerHTML = ''));
    card.querySelectorAll('#questionText, #selectedMood, #selectedActivity').forEach(
      output => (output.textContent = '')
    );
  });

  // Reset activity buttons
  document.querySelectorAll('.activity-list button').forEach(btn => {
    btn.classList.remove('selected');
    btn.disabled = false;
  });

  // Reset image upload UI
  const fileInput = document.getElementById('photoUpload');
  const sendButton = document.querySelector('.submit-button');
  const previewContainer = document.getElementById('imagePreviewContainer');
  if (fileInput) fileInput.disabled = false;
  if (sendButton) sendButton.disabled = false;
  if (previewContainer) previewContainer.innerHTML = '';

  // Make sure navigation is visible so that sections (like the spinner) are accessible
  document.querySelector('nav.navigation')?.classList.remove('hidden');

  // Reset question spinner and skips display
  const questionDisplay = document.getElementById('questionText');
  if (questionDisplay) questionDisplay.textContent = '';
  const skipsDisplay = document.getElementById('skipsLeft');
  if (skipsDisplay) skipsDisplay.textContent = 'Skips left: 3';

  // Finally, reinitialize the entire app.
  // This will recreate dailyTopics, redraw the spinner wheel, and rebind all UI handlers.
  initApp();

  playSound('reset');
  alert('✅ Daily fields reset successfully!');

  // ✅ Auto refresh to reload all UI cleanly
  location.reload();
}


/* ===============================
   TOGGLE Section Visibility
=============================== */
/**
 * Toggles visibility of a section.
 * Ensures only one section is open at a time.
 * Includes checks for daily limits and completion status.
 */
function toggleSection(sectionId) {
  const section = document.getElementById(sectionId);
  if (!section) return;

  const today = new Date().toISOString().split('T')[0];

  // =============================
  // 🛑 PREVENT ACCESS IF SECTION COMPLETED
  // =============================

  if (sectionId === 'show-tell' && localStorage.getItem(`showTellComplete_${today}`) === 'true') {
    alert("🎉 You’ve already completed Show & Tell today!");
    return;
  }

  if (sectionId === 'activity-choice' && localStorage.getItem(`activityChoiceComplete_${today}`) === 'true') {
    alert("🎉 You’ve already picked your activities today!");
    return;
  }

  if (sectionId === 'question-spinner') {
    const dailyTopics = getDailyTopics();
    if (dailyTopics.length === 0) {
      alert("🎉 You've answered all the questions for today!");
      return;
    }
  }

  // =============================
  // 🔁 CLOSE ANY OTHER OPEN SECTIONS
  // =============================

  const allCards = document.querySelectorAll('.card');
  allCards.forEach(card => {
    if (card !== section) card.classList.add('hidden');
  });

  // =============================
  // ✅ TOGGLE TARGET SECTION
  // =============================

  section.classList.toggle('hidden');
  console.log(`🔄 Toggled section: ${sectionId}, Now hidden? ${section.classList.contains('hidden')}`);
}

// =============================
// ✅ Load Functions Inline
// =============================


window.selectActivity = selectActivity;
window.selectMood = selectMood;
window.completeSection = completeSection;
window.toggleSection = toggleSection;
window.clearCanvas = clearCanvas;
window.downloadDrawing = downloadDrawing;
window.openFullscreen = openFullscreen;
window.submitDrawing = submitDrawing;
window.resetDailyFields = resetDailyFields;
window.resetProgress = resetProgress;
window.setupImagePreview = setupImagePreview;
