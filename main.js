// Main JS Logic for AI Study Assistant

const API_BASE_URL = 'http://localhost:3000/api';

const cache = {};

// Helper with delay and retry logic
async function callAPI(url, options = {}, retries = 1) {
  await new Promise(res => setTimeout(res, 1000));
  
  try {
    const response = await fetch(url, options);
    if (!response.ok) {
      if (response.status === 429 && retries > 0) {
        console.log("Rate limited. Retrying...");
        await new Promise(r => setTimeout(r, 2000));
        return callAPI(url, options, retries - 1);
      }
      throw new Error(`API Error: ${response.status}`);
    }
    return await response.json();
  } catch (err) {
    if (retries > 0) {
      console.log("Error occurred. Retrying...");
      await new Promise(r => setTimeout(r, 2000));
      return callAPI(url, options, retries - 1);
    }
    throw err;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initNav();
  initTabs();
  initLogin();
  initChat();
  initUpload();
  initSummary();
  initQuiz();
  initFlashcards();
  initAnalytics();
  initPlanner();
});

// --- Left Navigation Logic ---
function initNav() {
  const navItems = document.querySelectorAll('.nav-item');
  const mainPanels = document.querySelectorAll('.view-section');

  navItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      // Remove active from all nav items
      navItems.forEach(n => n.classList.remove('active'));
      item.classList.add('active');

      // Hide all main panels
      mainPanels.forEach(p => p.classList.add('hidden'));

      // Show target panel
      const targetId = `view-${item.dataset.target}`;
      const targetPanel = document.getElementById(targetId);
      if (targetPanel) {
        targetPanel.classList.remove('hidden');
      }
    });
  });
}

// --- Tabs Logic (Workspace) ---
function initTabs() {
  const tabBtns = document.querySelectorAll('.ws-tab');
  const panels = document.querySelectorAll('.ws-panel');

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      // Remove active from all
      tabBtns.forEach(b => b.classList.remove('active'));
      panels.forEach(p => p.classList.add('hidden'));
      panels.forEach(p => p.classList.remove('active'));

      // Add active to clicked
      btn.classList.add('active');
      const targetId = `ws-${btn.dataset.panel}`;
      const targetPanel = document.getElementById(targetId);
      if (targetPanel) {
        targetPanel.classList.remove('hidden');
        targetPanel.classList.add('active');
      }
    });
  });
}

// --- Chat Logic ---
function initChat() {
  const chatInput = document.getElementById('chatInput');
  const sendBtn = document.getElementById('sendBtn');
  const chatMessages = document.getElementById('chatMessages');
  const suggestionChips = document.querySelectorAll('.chip');
  const chatWelcome = document.querySelector('.chat-welcome');

  function addMessage(text, isUser = true, isError = false) {
    if (chatWelcome) chatWelcome.style.display = 'none';

    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${isUser ? 'user' : 'ai'} ${isError ? 'error' : ''}`;
    
    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.innerHTML = isUser ? 'S' : '<i class="ph-fill ph-brain"></i>';

    const content = document.createElement('div');
    content.className = 'message-content';

    if (!isUser && text === 'typing') {
      content.innerHTML = `
        <div class="typing-indicator">
          <div class="typing-dot"></div>
          <div class="typing-dot"></div>
          <div class="typing-dot"></div>
        </div>
      `;
      msgDiv.id = 'typingIndicator';
    } else {
      // Render markdown roughly (bold and line breaks)
      let formattedText = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      formattedText = formattedText.replace(/\n/g, '<br>');
      content.innerHTML = `<p>${formattedText}</p>`;
    }

    msgDiv.appendChild(avatar);
    msgDiv.appendChild(content);
    chatMessages.appendChild(msgDiv);

    // Scroll to bottom
    const chatContainer = document.getElementById('chatContainer');
    chatContainer.scrollTop = chatContainer.scrollHeight;
  }

  let chatTimeout;
  let isGeneratingChat = false;

  const personalityChips = document.querySelectorAll('.personality-chip');
  personalityChips.forEach(chip => {
    chip.addEventListener('click', () => {
      personalityChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
    });
  });

  async function handleSend(text) {
    if (!text.trim() || isGeneratingChat) return;
    
    // User message
    addMessage(text, true);
    chatInput.value = '';

    clearTimeout(chatTimeout);
    chatTimeout = setTimeout(async () => {
      isGeneratingChat = true;
      // Show typing
      addMessage('typing', false);
      
      try {
        const activeChip = document.querySelector('.personality-chip.active');
        const mode = activeChip ? activeChip.dataset.mode : 'standard';
        
        const cacheKey = 'chat_' + mode + '_' + text.toLowerCase();
        let data;
        if (cache[cacheKey]) {
          data = cache[cacheKey];
          await new Promise(r => setTimeout(r, 500));
        } else {
          data = await callAPI(`${API_BASE_URL}/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: text, mode })
          });
          if (data.reply) cache[cacheKey] = data;
        }
        
        const indicator = document.getElementById('typingIndicator');
        if (indicator) indicator.remove();

        if (data.reply) {
          addMessage(data.reply, false);
        } else {
          addMessage("Sorry, I encountered an error answering your question.", false, true);
        }
      } catch (error) {
        console.error(error);
        const indicator = document.getElementById('typingIndicator');
        if (indicator) indicator.remove();
        addMessage("Error connecting to server. Please ensure backend is running and API key is set.", false, true);
      } finally {
        isGeneratingChat = false;
      }
    }, 800);
  }

  sendBtn.addEventListener('click', () => handleSend(chatInput.value));
  chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleSend(chatInput.value);
  });

  suggestionChips.forEach(chip => {
    chip.addEventListener('click', () => handleSend(chip.textContent));
  });
}

// --- Upload Logic ---
function initUpload() {
  const fileInput = document.getElementById('fileInput');
  const uploadCard = document.getElementById('uploadCard');
  const uploadSteps = document.querySelector('.upload-steps');

  fileInput.addEventListener('change', async (e) => {
    if (e.target.files.length > 0) {
      const file = e.target.files[0];
      
      // Update UI to show uploading state
      uploadCard.querySelector('h3').textContent = `Uploading ${file.name}...`;
      uploadCard.querySelector('p').textContent = 'Processing document';
      uploadSteps.classList.remove('hidden');
      
      const formData = new FormData();
      formData.append('file', file);
      
      try {
        const response = await fetch(`${API_BASE_URL}/upload`, {
          method: 'POST',
          body: formData
        });
        const data = await response.json();
        
        if (data.success) {
          uploadSteps.children[0].innerHTML = '<i class="ph-fill ph-check-circle"></i> Extracted content';
          uploadSteps.children[0].classList.replace('text-primary', 'text-success');
          
          setTimeout(() => {
            uploadSteps.children[1].innerHTML = '<i class="ph-fill ph-check-circle"></i> Summary generated';
            uploadSteps.children[1].classList.replace('text-muted', 'text-success');
          }, 1000);
          
          setTimeout(() => {
            uploadSteps.children[2].innerHTML = '<i class="ph-fill ph-check-circle"></i> Quiz created';
            uploadSteps.children[2].classList.replace('text-muted', 'text-success');
            
            // Navigate to Learn view
            document.querySelector('.nav-item[data-target="learn"]').click();
            document.getElementById('learn-title').textContent = file.name;
            
            // Clear global cache for the new document
            for (let key in cache) delete cache[key];
            
            // Reset upload card after navigating away
            setTimeout(() => {
              uploadCard.querySelector('h3').textContent = 'Upload New Note';
              uploadCard.querySelector('p').textContent = 'Drag & Drop or Browse';
              uploadSteps.classList.add('hidden');
            }, 1000);
          }, 2000);
          
          // Update "My Notes" UI
          const emptyState = document.querySelector('#notesGrid .empty-state');
          const notesGrid = document.getElementById('notesGrid');
          if (emptyState) emptyState.style.display = 'none';
          if (notesGrid) {
            const noteCard = document.createElement('div');
            noteCard.className = 'glass-card p-4';
            noteCard.style.padding = '1.5rem';
            noteCard.innerHTML = `
              <div class="note-icon" style="font-size: 2rem; color: var(--primary); margin-bottom: 1rem;"><i class="ph-fill ph-file-pdf"></i></div>
              <div class="note-info">
                <h4 style="margin-bottom: 0.5rem;">${file.name}</h4>
                <p class="text-muted" style="font-size: 0.8rem;">${new Date().toLocaleDateString()}</p>
              </div>
            `;
            notesGrid.appendChild(noteCard);
          }
          
          if(window.updateAnalytics) window.updateAnalytics('topic_uploaded');
        }
      } catch (error) {
        console.error(error);
        uploadCard.querySelector('h3').textContent = 'Upload Failed';
        uploadCard.querySelector('h3').style.color = 'var(--danger)';
      }
    }
  });
}

// --- Summary Logic ---
function initSummary() {
  const regenerateBtn = document.getElementById('generate-summary-btn');
  const summaryList = document.getElementById('summaryList');
  const explainBtn = document.getElementById('btn-explain-simpler');

  let isGeneratingSummary = false;
  let isEli5 = false;

  async function generateSummary() {
    if (isGeneratingSummary) return;
    isGeneratingSummary = true;
    summaryList.innerHTML = `
      <div class="summary-bullet glass-card" style="padding: 1.5rem; border-radius: 1rem;">
        <div class="skeleton skeleton-title"></div>
        <div class="skeleton skeleton-text"></div>
        <div class="skeleton skeleton-text"></div>
        <div class="skeleton skeleton-text short"></div>
      </div>
      <div class="summary-bullet glass-card" style="padding: 1.5rem; border-radius: 1rem; margin-top: 1rem;">
        <div class="skeleton skeleton-text"></div>
        <div class="skeleton skeleton-text short"></div>
      </div>
    `;
    try {
      const cacheKey = 'summary_' + isEli5;
      let data;
      if (cache[cacheKey]) {
        data = cache[cacheKey];
        await new Promise(r => setTimeout(r, 500));
      } else {
        data = await callAPI(`${API_BASE_URL}/summary?eli5=${isEli5}`);
        if (data.summary) cache[cacheKey] = data;
      }
      
      if (data.summary) {
        summaryList.innerHTML = '';
        data.summary.forEach(item => {
          const div = document.createElement('div');
          div.className = 'summary-bullet glass-card';
          div.style.padding = '1.5rem';
          div.style.borderRadius = '1rem';
          div.style.display = 'flex';
          div.style.gap = '1rem';
          div.style.alignItems = 'flex-start';
          div.innerHTML = `
            <i class="ph-fill ph-check-circle text-primary" style="font-size: 1.5rem; margin-top: 0.1rem;"></i>
            <p style="line-height: 1.6; font-size: 1.05rem;">${item}</p>
          `;
          summaryList.appendChild(div);
        });
      }
    } catch (error) {
      summaryList.innerHTML = '<div class="summary-bullet glass-card" style="padding: 1.5rem; border-radius: 1rem; color: #fca5a5;">Error generating summary. Please try again.</div>';
    } finally {
      isGeneratingSummary = false;
    }
  }

  if (regenerateBtn) regenerateBtn.addEventListener('click', generateSummary);
  
  if (explainBtn) {
    explainBtn.addEventListener('click', () => {
      isEli5 = !isEli5;
      explainBtn.innerHTML = isEli5 ? '<i class="ph ph-magic-wand"></i> Back to Professional' : '<i class="ph ph-magic-wand"></i> Explain Simpler';
      generateSummary();
    });
  }
}

// --- Quiz Logic ---
function initQuiz() {
  const nextBtn = document.getElementById('quiz-next');
  const quizCard = document.querySelector('.quiz-card-large');
  const quizContainer = document.getElementById('quiz-options-container');
  const explanationBox = document.getElementById('quiz-feedback');
  
  let isGeneratingQuiz = false;
  async function generateQuiz() {
    if (isGeneratingQuiz) return;
    isGeneratingQuiz = true;
    quizCard.querySelector('.quiz-q').innerHTML = 'Creating personalized adaptive quiz... <i class="ph ph-spinner ph-spin"></i>';
    quizContainer.innerHTML = `
      <div class="skeleton" style="height: 3.5rem; border-radius: 0.75rem; margin-bottom: 0.5rem;"></div>
      <div class="skeleton" style="height: 3.5rem; border-radius: 0.75rem; margin-bottom: 0.5rem;"></div>
      <div class="skeleton" style="height: 3.5rem; border-radius: 0.75rem; margin-bottom: 0.5rem;"></div>
      <div class="skeleton" style="height: 3.5rem; border-radius: 0.75rem; margin-bottom: 0.5rem;"></div>
    `;
    explanationBox.classList.add('hidden');
    
    try {
      const data = await callAPI(`${API_BASE_URL}/quiz`);
      
      if (data.question) {
        quizCard.querySelector('.quiz-q').textContent = data.question;
        
        let optionsHtml = '';
        data.options.forEach((opt, index) => {
          optionsHtml += `<button class="quiz-opt" style="padding: 1.25rem; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1); border-radius: 1rem; text-align: left; font-size: 1.05rem; cursor: pointer; transition: all 0.3s; color: var(--text-main);" data-index="${index}">${opt}</button>`;
        });
        
        quizContainer.innerHTML = optionsHtml;
        
        // Attach event listeners to new options
        const options = quizContainer.querySelectorAll('.quiz-opt');
        
        options.forEach(opt => {
          opt.addEventListener('click', () => {
            if (quizContainer.querySelector('.correct')) return;
            
            const selectedIndex = parseInt(opt.dataset.index);
            if (selectedIndex === data.correctOptionIndex) {
              opt.style.background = 'rgba(34, 197, 94, 0.2)';
              opt.style.borderColor = '#22c55e';
              opt.classList.add('correct');
              explanationBox.innerHTML = `<p style="font-size: 1.05rem; line-height: 1.5; color: #86efac;"><strong>Correct!</strong> ${data.explanation}</p>`;
              if(window.updateAnalytics) window.updateAnalytics('quiz_passed');
            } else {
              opt.style.background = 'rgba(239, 68, 68, 0.2)';
              opt.style.borderColor = '#ef4444';
              opt.classList.add('wrong');
              
              options[data.correctOptionIndex].style.background = 'rgba(34, 197, 94, 0.2)';
              options[data.correctOptionIndex].style.borderColor = '#22c55e';
              options[data.correctOptionIndex].classList.add('correct');
              
              explanationBox.innerHTML = `<p style="font-size: 1.05rem; line-height: 1.5; color: #fca5a5;"><strong>Incorrect.</strong> ${data.explanation}</p>`;
              if(window.updateAnalytics) window.updateAnalytics('quiz_failed');
            }
            explanationBox.classList.remove('hidden');
          });
        });
      }
    } catch (error) {
      quizCard.querySelector('.quiz-q').innerHTML = '<span style="color: var(--danger)">Error generating quiz. Please try again.</span>';
    } finally {
      isGeneratingQuiz = false;
    }
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', generateQuiz);
  }
}

// --- Flashcard Logic ---
function initFlashcards() {
  const startRevBtn = document.getElementById('fc-generate');
  const mainFlashcard = document.getElementById('main-flashcard');
  const controls = document.getElementById('fc-counter');
  const prevBtn = document.getElementById('fc-prev');
  const nextBtn = document.getElementById('fc-next');
  
  let currentCards = [];
  let currentIndex = 0;
  let isGeneratingCards = false;

  async function generateFlashcards() {
    if (isGeneratingCards) return;
    isGeneratingCards = true;
    if(startRevBtn) startRevBtn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Generating...';
    
    try {
      const cacheKey = 'flashcards';
      let data;
      if (cache[cacheKey]) {
        data = cache[cacheKey];
        await new Promise(r => setTimeout(r, 500));
      } else {
        data = await callAPI(`${API_BASE_URL}/flashcards`);
        if (data.flashcards && data.flashcards.length > 0) cache[cacheKey] = data;
      }
      
      if (data.flashcards && data.flashcards.length > 0) {
        currentCards = data.flashcards;
        currentIndex = 0;
        renderCard();
      }
      if(startRevBtn) {
        startRevBtn.innerHTML = '<i class="ph ph-arrows-clockwise"></i> Regenerate Cards';
        startRevBtn.style.color = '';
      }
    } catch (error) {
      console.error(error);
      if(startRevBtn) {
        startRevBtn.innerHTML = '<i class="ph ph-play"></i> Retry Generation';
        startRevBtn.style.color = '#fca5a5';
      }
    } finally {
      isGeneratingCards = false;
    }
  }

  function renderCard() {
    if (currentCards.length === 0 || !mainFlashcard) return;
    const card = currentCards[currentIndex];
    
    // Ensure card is not flipped when showing new one
    mainFlashcard.classList.remove('flipped');
    
    mainFlashcard.querySelector('.question').textContent = card.question;
    mainFlashcard.querySelector('.answer').textContent = card.answer;
    
    if(controls) controls.textContent = `${currentIndex + 1} / ${currentCards.length}`;
  }

  if (startRevBtn) startRevBtn.addEventListener('click', generateFlashcards);
  
  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      if (currentCards.length > 0) {
        currentIndex = (currentIndex - 1 + currentCards.length) % currentCards.length;
        renderCard();
      }
    });
  }
  
  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      if (currentCards.length > 0) {
        currentIndex = (currentIndex + 1) % currentCards.length;
        renderCard();
      }
    });
  }

  // Hook analytics to click
  if(mainFlashcard) {
    mainFlashcard.addEventListener('click', () => {
      mainFlashcard.classList.toggle('flipped');
      if(mainFlashcard.classList.contains('flipped')) {
        if(window.updateAnalytics) window.updateAnalytics('card_reviewed');
      }
    });
  }
}

// --- Analytics Logic ---
function initAnalytics() {
  const defaultAnalytics = {
    studyTimeSeconds: 0,
    cardsReviewed: 0,
    quizzesPassed: 0,
    quizzesAttempted: 0,
    streak: 1,
    topicsStudied: 0,
    activityData: [40, 60, 30, 80, 50, 95, 70]
  };

  let analyticsData = JSON.parse(localStorage.getItem('studyAnalytics')) || defaultAnalytics;
  
  // Patch old analytics missing new fields
  if(analyticsData.streak === undefined) analyticsData.streak = 1;
  if(analyticsData.topicsStudied === undefined) analyticsData.topicsStudied = 0;

  function saveAnalytics() {
    localStorage.setItem('studyAnalytics', JSON.stringify(analyticsData));
    renderAnalytics();
  }

  function formatTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  }

  function renderAnalytics() {
    // Calculate Accuracy
    const accuracy = analyticsData.quizzesAttempted > 0 
      ? Math.round((analyticsData.quizzesPassed / analyticsData.quizzesAttempted) * 100) 
      : 0;

    // Update Overall Accuracy
    const accuracyValEl = document.getElementById('overall-accuracy-value');
    const accuracyCircleEl = document.getElementById('overall-accuracy-circle');
    const sidebarAccuracyEl = document.getElementById('sidebar-quiz-accuracy');

    if (accuracyValEl) accuracyValEl.textContent = `${accuracy}%`;
    if (sidebarAccuracyEl) sidebarAccuracyEl.textContent = `${accuracy}%`;
    if (accuracyCircleEl) {
      const radius = accuracyCircleEl.r.baseVal.value;
      const circumference = radius * 2 * Math.PI;
      const offset = circumference - (accuracy / 100) * circumference;
      accuracyCircleEl.style.strokeDasharray = `${circumference} ${circumference}`;
      accuracyCircleEl.style.strokeDashoffset = offset;
    }

    // Update Stats
    const studyTimeEl = document.getElementById('dash-study-time');
    const accuracyEl = document.getElementById('dash-accuracy');
    const streakEl = document.getElementById('dash-streak');
    const topicsEl = document.getElementById('dash-topics');
    const sidebarStreakEl = document.getElementById('sidebar-streak');

    const formattedTime = formatTime(analyticsData.studyTimeSeconds);
    if (studyTimeEl) studyTimeEl.textContent = formattedTime;
    if (accuracyEl) accuracyEl.textContent = `${accuracy}%`;
    if (streakEl) streakEl.textContent = `${analyticsData.streak} days`;
    if (topicsEl) topicsEl.textContent = analyticsData.topicsStudied;
    if (sidebarStreakEl) sidebarStreakEl.textContent = analyticsData.streak;

    // Render Graph
    const graphContainer = document.getElementById('activity-graph-container');
    if (graphContainer) {
      graphContainer.innerHTML = '';
      analyticsData.activityData.forEach(val => {
        const bar = document.createElement('div');
        bar.className = 'chart-bar';
        bar.style.height = `${val}%`;
        if (val >= 90) {
          bar.style.background = 'var(--primary)';
          bar.style.boxShadow = '0 0 20px var(--primary-glow)';
        }
        graphContainer.appendChild(bar);
      });
    }
  }

  window.updateAnalytics = function(action) {
    if (action === 'card_reviewed') {
      analyticsData.cardsReviewed += 1;
    } else if (action === 'quiz_passed') {
      analyticsData.quizzesPassed += 1;
      analyticsData.quizzesAttempted += 1;
    } else if (action === 'quiz_failed') {
      analyticsData.quizzesAttempted += 1;
    } else if (action === 'topic_uploaded') {
      analyticsData.topicsStudied += 1;
    }
    
    // Randomize activity slightly to make graph look alive
    if (Math.random() > 0.5) {
      analyticsData.activityData.shift();
      analyticsData.activityData.push(Math.floor(Math.random() * 80) + 20);
    }

    saveAnalytics();
  };

  // Study Time Tracker
  setInterval(() => {
    analyticsData.studyTimeSeconds += 60; // add 1 minute every minute
    saveAnalytics();
  }, 60000);

  // Initial Render
  renderAnalytics();
}

// --- Login Logic ---
function initLogin() {
  const loginOverlay = document.getElementById('login-overlay');
  const loginForm = document.getElementById('login-form');
  const loginNameInput = document.getElementById('login-name');
  const sidebarName = document.getElementById('sidebar-name');
  const sidebarAvatar = document.getElementById('sidebar-avatar');
  const logoutBtn = document.getElementById('logout-btn');

  function updateUserInfo(name) {
    if (sidebarName) sidebarName.textContent = name;
    if (sidebarAvatar) sidebarAvatar.textContent = name.charAt(0).toUpperCase();
  }

  function checkAuth() {
    const userStr = localStorage.getItem('currentUser');
    if (userStr) {
      const user = JSON.parse(userStr);
      updateUserInfo(user.name);
      loginOverlay.classList.add('hidden');
    } else {
      loginOverlay.classList.remove('hidden');
    }
  }

  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = loginNameInput.value.trim();
      const email = document.getElementById('login-email').value.trim();
      
      if (name && email) {
        const btn = loginForm.querySelector('button');
        const oldText = btn.innerHTML;
        btn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Connecting to DB...';
        btn.disabled = true;

        try {
          const data = await callAPI(`${API_BASE_URL}/auth`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email })
          });

          if (data.success && data.user) {
            localStorage.setItem('currentUser', JSON.stringify(data.user));
            updateUserInfo(data.user.name);
            loginOverlay.classList.add('hidden');
          } else {
            alert(data.error || 'Failed to connect to database.');
          }
        } catch (error) {
          console.error(error);
          alert('Error connecting to backend database. Ensure server is running.');
        } finally {
          btn.innerHTML = oldText;
          btn.disabled = false;
        }
      }
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      localStorage.removeItem('currentUser');
      loginForm.reset();
      loginOverlay.classList.remove('hidden');
    });
  }

  // Initial check
  checkAuth();
}

// --- Planner Logic ---
function initPlanner() {
  const generateBtn = document.getElementById('generate-planner-btn');
  const plannerContent = document.getElementById('planner-content');
  
  let isGeneratingPlanner = false;
  
  async function generatePlanner() {
    if (isGeneratingPlanner) return;
    isGeneratingPlanner = true;
    
    if (plannerContent) {
      plannerContent.innerHTML = `
        <div class="glass-card" style="padding: 2rem; border-radius: 1rem;">
          <div class="skeleton skeleton-title"></div>
          <div class="skeleton skeleton-text"></div>
          <div class="skeleton skeleton-text"></div>
        </div>
        <div class="glass-card" style="padding: 2rem; border-radius: 1rem; margin-top: 1rem;">
          <div class="skeleton skeleton-title"></div>
          <div class="skeleton skeleton-text"></div>
          <div class="skeleton skeleton-text short"></div>
        </div>
      `;
    }
    if (generateBtn) generateBtn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Generating...';
    
    try {
      const cacheKey = 'planner';
      let data;
      if (cache[cacheKey]) {
        data = cache[cacheKey];
        await new Promise(r => setTimeout(r, 500));
      } else {
        data = await callAPI(`${API_BASE_URL}/planner`);
        if (data && data.goal) cache[cacheKey] = data;
      }
      
      if (data && data.goal && plannerContent) {
        let topicsHtml = (data.priorityTopics || []).map(t => `<span class="badge" style="background: rgba(139, 92, 246, 0.2); color: var(--primary); padding: 0.25rem 0.75rem; border-radius: 1rem; margin-right: 0.5rem; display: inline-block; margin-bottom: 0.5rem;">${t}</span>`).join('');
        
        let scheduleHtml = (data.schedule || []).map(s => `
          <div style="background: rgba(255,255,255,0.03); padding: 1rem; border-radius: 0.75rem; border-left: 3px solid var(--primary); margin-bottom: 0.75rem;">
            <h4 style="font-size: 1rem; color: #d8b4fe; margin-bottom: 0.25rem;">${s.day}</h4>
            <p style="font-weight: 500; font-size: 0.95rem; margin-bottom: 0.25rem;">${s.task}</p>
            <p style="font-size: 0.85rem; color: var(--text-muted);"><i class="ph ph-target"></i> ${s.focus}</p>
          </div>
        `).join('');
        
        plannerContent.innerHTML = `
          <div class="glass-card" style="padding: 1.5rem; border-radius: 1rem; margin-bottom: 1rem;">
            <h3 style="font-size: 1.1rem; margin-bottom: 0.5rem; display: flex; align-items: center; gap: 0.5rem;"><i class="ph-fill ph-flag-checkered text-primary"></i> Objective</h3>
            <p style="color: var(--text-muted); line-height: 1.5; font-size: 0.95rem;">${data.goal}</p>
          </div>
          <div class="glass-card" style="padding: 1.5rem; border-radius: 1rem; margin-bottom: 1rem;">
            <h3 style="font-size: 1.1rem; margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem;"><i class="ph-fill ph-star text-primary"></i> Priority Topics</h3>
            <div>${topicsHtml}</div>
          </div>
          <div class="glass-card" style="padding: 1.5rem; border-radius: 1rem;">
            <h3 style="font-size: 1.1rem; margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem;"><i class="ph-fill ph-calendar text-primary"></i> Revision Schedule</h3>
            ${scheduleHtml}
          </div>
        `;
        if (generateBtn) generateBtn.innerHTML = '<i class="ph ph-arrows-clockwise"></i> Regenerate Plan';
        if(window.updateAnalytics) window.updateAnalytics('planner_generated');
      }
    } catch (error) {
      if (plannerContent) plannerContent.innerHTML = '<div class="glass-card" style="padding: 1.5rem; border-radius: 1rem; color: #fca5a5;">Error generating plan. Please try again.</div>';
      if (generateBtn) generateBtn.innerHTML = '<i class="ph ph-magic-wand"></i> Generate Plan';
    } finally {
      isGeneratingPlanner = false;
    }
  }

  if (generateBtn) generateBtn.addEventListener('click', generatePlanner);
}
