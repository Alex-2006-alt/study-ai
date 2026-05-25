import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { PDFParse } from 'pdf-parse';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());

async function generateFromOpenRouter(prompt) {
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      "model": "openrouter/free",
      "messages": [
        { "role": "user", "content": prompt }
      ]
    })
  });
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenRouter Error: ${response.status} ${err}`);
  }
  const data = await response.json();
  return data.choices[0].message.content;
}

const DOCUMENTS_FILE = 'documents.json';
const ANALYTICS_FILE = 'analytics.json';
const USERS_FILE = 'users.json';

if (!fs.existsSync(USERS_FILE)) {
  fs.writeFileSync(USERS_FILE, '[]');
}
if (!fs.existsSync(DOCUMENTS_FILE)) {
  fs.writeFileSync(DOCUMENTS_FILE, '[]');
}
if (!fs.existsSync(ANALYTICS_FILE)) {
  fs.writeFileSync(ANALYTICS_FILE, '{}');
}

// Default OS notes text seed
const DEFAULT_OS_NOTES = `Operating System Notes:

1. What is an Operating System?
An Operating System (OS) is a software that acts as an interface between computer hardware and the user. It manages computer memory, processes, and all of its software and hardware. Without an OS, a computer is useless.

2. Key Functions of an OS:
- Processor Management: Manages the execution of processes and schedules CPU time.
- Memory Management: Allocates and deallocates memory space for programs.
- File System Management: Organizes and keeps track of files on storage devices.
- Device Management: Communicates with hardware controllers and peripherals.
- Security: Protects data and system resources from unauthorized access.

3. Process Management and CPU Scheduling:
A process is a program in execution. The CPU scheduling determines which process gets the CPU time. Common scheduling algorithms include First-Come-First-Serve (FCFS), Shortest Job Next (SJN), and Round Robin (RR). Multi-programming allows multiple programs to run simultaneously, increasing CPU utilization.

4. Memory Management:
The OS manages primary memory. It tracks every byte and decides which process gets memory and when. Virtual Memory is a technique that allows execution of processes that may not be completely in the primary memory, using disk storage as an extension of RAM. Paging and Segmentation are two primary techniques for virtual memory.

5. Deadlocks:
A deadlock is a situation where a set of processes are blocked because each process is holding a resource and waiting for another resource held by some other process. The four necessary conditions for deadlock are: Mutual Exclusion, Hold and Wait, No Preemption, and Circular Wait. Deadlock handling includes prevention, avoidance (e.g., Banker's Algorithm), and detection & recovery.

6. File Systems:
A file system is the structure and rules used by an OS to organize and manage files on a storage device. Common file systems include FAT32, NTFS, and ext4. Directories organize files hierarchically.`;

// Seed default OS notes if documents.json is empty
let docs = JSON.parse(fs.readFileSync(DOCUMENTS_FILE, 'utf8'));
if (docs.length === 0) {
  docs.push({
    id: 'default_os',
    userId: 'all',
    name: 'Operating System Notes',
    text: DEFAULT_OS_NOTES,
    createdAt: new Date(),
    charCount: DEFAULT_OS_NOTES.length
  });
  fs.writeFileSync(DOCUMENTS_FILE, JSON.stringify(docs, null, 2));
}

let currentDocumentText = DEFAULT_OS_NOTES;
let currentDocumentId = 'default_os';

const upload = multer({ dest: 'uploads/' });

// 0. Auth API
app.post('/api/auth', (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
    
    const users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
    let user = users.find(u => u.email === email);
    
    if (!user) {
      user = { id: Date.now().toString(), name: name || email.split('@')[0], email, password, createdAt: new Date() };
      users.push(user);
      fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
    } else {
      if (user.password && user.password !== password) {
        return res.status(401).json({ error: 'Invalid password' });
      } else if (!user.password) {
        user.password = password;
        fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
      }
    }
    
    const { password: _, ...userWithoutPassword } = user;
    res.json({ success: true, user: userWithoutPassword });
  } catch (error) {
    console.error('Auth error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// --- Documents API ---

// GET /api/notes - Get all notes for a user (or anonymous)
app.get('/api/notes', (req, res) => {
  try {
    const userId = req.query.userId || 'anonymous';
    const documents = JSON.parse(fs.readFileSync(DOCUMENTS_FILE, 'utf8'));
    const userDocs = documents.filter(doc => doc.userId === userId || doc.userId === 'all');
    const metadata = userDocs.map(({ id, userId, name, createdAt, charCount }) => ({
      id, userId, name, createdAt, charCount
    }));
    res.json(metadata);
  } catch (error) {
    console.error('Error fetching notes:', error);
    res.status(500).json({ error: 'Failed to fetch notes' });
  }
});

// POST /api/notes/:id/select - Select active note
app.post('/api/notes/:id/select', (req, res) => {
  try {
    const { id } = req.params;
    const documents = JSON.parse(fs.readFileSync(DOCUMENTS_FILE, 'utf8'));
    const doc = documents.find(d => d.id === id);
    if (!doc) return res.status(404).json({ error: 'Note not found' });

    currentDocumentText = doc.text;
    currentDocumentId = doc.id;
    res.json({ success: true, message: `Selected note: ${doc.name}`, activeId: doc.id });
  } catch (error) {
    console.error('Error selecting note:', error);
    res.status(500).json({ error: 'Failed to select note' });
  }
});

// DELETE /api/notes/:id - Delete a note
app.delete('/api/notes/:id', (req, res) => {
  try {
    const { id } = req.params;
    let documents = JSON.parse(fs.readFileSync(DOCUMENTS_FILE, 'utf8'));
    const initialLength = documents.length;
    documents = documents.filter(d => d.id !== id);

    if (documents.length === initialLength) {
      return res.status(404).json({ error: 'Note not found' });
    }

    fs.writeFileSync(DOCUMENTS_FILE, JSON.stringify(documents, null, 2));

    if (currentDocumentId === id) {
      const defaultDoc = documents.find(d => d.id === 'default_os');
      if (defaultDoc) {
        currentDocumentText = defaultDoc.text;
        currentDocumentId = defaultDoc.id;
      } else {
        currentDocumentText = "No document uploaded yet. Please upload a document to get started.";
        currentDocumentId = null;
      }
    }

    res.json({ success: true, message: 'Note deleted successfully' });
  } catch (error) {
    console.error('Error deleting note:', error);
    res.status(500).json({ error: 'Failed to delete note' });
  }
});

// --- Analytics API ---

// GET /api/analytics - Get analytics for a user
app.get('/api/analytics', (req, res) => {
  try {
    const userId = req.query.userId || 'anonymous';
    const analytics = JSON.parse(fs.readFileSync(ANALYTICS_FILE, 'utf8'));
    
    const defaultAnalytics = {
      studyTimeSeconds: 0,
      cardsReviewed: 0,
      quizzesPassed: 0,
      quizzesAttempted: 0,
      streak: 1,
      topicsStudied: 0,
      activityData: [40, 60, 30, 80, 50, 95, 70],
      topicMastery: {
        "Operating System Notes": { "passed": 0, "attempted": 0 }
      }
    };

    if (!analytics[userId]) {
      analytics[userId] = defaultAnalytics;
      fs.writeFileSync(ANALYTICS_FILE, JSON.stringify(analytics, null, 2));
    }

    res.json(analytics[userId]);
  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// POST /api/analytics - Save analytics for a user
app.post('/api/analytics', (req, res) => {
  try {
    const { userId, analyticsData } = req.body;
    if (!userId) return res.status(400).json({ error: 'User ID is required' });

    const analytics = JSON.parse(fs.readFileSync(ANALYTICS_FILE, 'utf8'));
    analytics[userId] = analyticsData;
    fs.writeFileSync(ANALYTICS_FILE, JSON.stringify(analytics, null, 2));

    res.json({ success: true, message: 'Analytics saved successfully' });
  } catch (error) {
    console.error('Error saving analytics:', error);
    res.status(500).json({ error: 'Failed to save analytics' });
  }
});

// 1. Upload API
app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const userId = req.body.userId || 'anonymous';
    
    // Read PDF
    const dataBuffer = fs.readFileSync(req.file.path);
    const parser = new PDFParse({ data: dataBuffer });
    const data = await parser.getText();
    await parser.destroy();
    
    const extractedText = data.text || "No text could be extracted from this PDF.";
    
    const documents = JSON.parse(fs.readFileSync(DOCUMENTS_FILE, 'utf8'));
    const newDoc = {
      id: 'doc_' + Date.now().toString(),
      userId,
      name: req.file.originalname,
      text: extractedText,
      createdAt: new Date(),
      charCount: extractedText.length
    };
    documents.push(newDoc);
    fs.writeFileSync(DOCUMENTS_FILE, JSON.stringify(documents, null, 2));

    currentDocumentText = newDoc.text;
    currentDocumentId = newDoc.id;
    
    fs.unlinkSync(req.file.path);
    
    res.json({ 
      success: true, 
      message: 'Document processed successfully', 
      charCount: currentDocumentText.length,
      doc: {
        id: newDoc.id,
        name: newDoc.name,
        charCount: newDoc.charCount,
        createdAt: newDoc.createdAt
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to process document' });
  }
});

// 2. Chat API
app.post('/api/chat', async (req, res) => {
  try {
    const { message, mode } = req.body;
    
    let personality = "You are an AI Study Assistant helping a student understand their notes.";
    if (mode === 'beginner') {
      personality = "You are an AI Study Assistant explaining concepts to an absolute beginner. Use simple analogies, avoid jargon, and be extremely encouraging.";
    } else if (mode === 'exam') {
      personality = "You are an AI Exam Prep Assistant. Focus on key terms, likely exam questions, concise definitions, and test-taking strategies.";
    } else if (mode === 'concept') {
      personality = "You are an AI Concept Breakdown Assistant. Break down complex ideas into step-by-step logical components using bullet points and clear hierarchy.";
    }
    
    const prompt = `${personality}
    Use the following document text to answer the question. If the answer is not in the text, you can use your general knowledge but mention it's outside the notes.
    
    DOCUMENT TEXT:
    ${currentDocumentText.substring(0, 30000)}
    
    STUDENT QUESTION: ${message}`;

    const responseText = await generateFromOpenRouter(prompt);
    
    res.json({ reply: responseText });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to generate response. Is the API key set?' });
  }
});

// 3. Generate Summary API
app.get('/api/summary', async (req, res) => {
  try {
    const isEli5 = req.query.eli5 === 'true';
    const styleInstruction = isEli5 
      ? "Explain the summary as if the reader is 5 years old (ELI5 style). Keep it simple and easy." 
      : "Provide a professional, academic summary with key takeaways.";
      
    const prompt = `Based on the following document, generate a summary. ${styleInstruction}
    Return strictly a JSON array of strings, where each string is a short bullet point. Do not wrap in markdown tags like \`\`\`json.
    
    DOCUMENT TEXT:
    ${currentDocumentText.substring(0, 30000)}`;

    const responseText = await generateFromOpenRouter(prompt);
    
    let text = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
    let bulletPoints = [];
    try {
        bulletPoints = JSON.parse(text);
    } catch (e) {
        bulletPoints = [text];
    }
    
    res.json({ summary: bulletPoints });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to generate summary' });
  }
});

// 4. Generate Quiz API
app.get('/api/quiz', async (req, res) => {
  try {
    const difficulty = req.query.difficulty || 'medium';
    let difficultyInstruction = '';
    if (difficulty === 'easy') {
      difficultyInstruction = 'Make the question very easy and straightforward. Test basic definitions and concepts.';
    } else if (difficulty === 'hard') {
      difficultyInstruction = 'Make the question extremely difficult and challenging. Use tricky distractors and require deep understanding or application of concepts.';
    } else {
      difficultyInstruction = 'Make the question of medium difficulty. Test good understanding of the concepts.';
    }

    const prompt = `Based on the following document, generate 1 multiple choice question to test the student's understanding.
    DIFFICULTY REQUIREMENT: ${difficultyInstruction}
    IMPORTANT: Randomize the position of the correct answer! Do not always put it in the same spot. Make sure the correct option is placed at a random index (0, 1, 2, or 3).
    Return strictly a JSON object with this exact format. Do not include markdown formatting:
    {
      "question": "The question text",
      "options": ["Option 1", "Option 2", "Option 3", "Option 4"],
      "correctOptionIndex": 2, // THIS MUST BE A RANDOM INDEX BETWEEN 0 AND 3
      "explanation": "Why this is correct"
    }
    
    DOCUMENT TEXT:
    ${currentDocumentText.substring(0, 30000)}`;

    const responseText = await generateFromOpenRouter(prompt);
    
    let text = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
    const quizData = JSON.parse(text);
    
    res.json(quizData);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to generate quiz' });
  }
});

// 5. Generate Flashcards API
app.get('/api/flashcards', async (req, res) => {
  try {
    const prompt = `Based on the following document, generate 5 flashcards for studying.
    Return strictly a JSON array of objects with this format. Do not include markdown formatting:
    [
      { "question": "Question on front", "answer": "Answer on back" }
    ]
    
    DOCUMENT TEXT:
    ${currentDocumentText.substring(0, 30000)}`;

    const responseText = await generateFromOpenRouter(prompt);
    
    let text = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
    const flashcards = JSON.parse(text);
    
    res.json({ flashcards });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to generate flashcards' });
  }
});

// 6. Generate Planner API
app.get('/api/planner', async (req, res) => {
  try {
    const prompt = `Based on the following document, create a structured Study Planner / Roadmap.
    Provide:
    1. A short overall goal.
    2. 3 priority topics to focus on.
    3. A suggested revision schedule (e.g., Day 1, Day 2, Day 3) with a specific task and focus for each day.
    Return strictly a JSON object matching this schema without markdown:
    {
      "goal": "String",
      "priorityTopics": ["Topic 1", "Topic 2", "Topic 3"],
      "schedule": [
        {"day": "Day 1", "task": "String", "focus": "String"},
        {"day": "Day 2", "task": "String", "focus": "String"}
      ]
    }
    
    DOCUMENT TEXT:
    ${currentDocumentText.substring(0, 30000)}`;

    const responseText = await generateFromOpenRouter(prompt);
    
    let text = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
    const plannerData = JSON.parse(text);
    
    res.json(plannerData);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to generate planner' });
  }
});

// 7. Generate Mindmap API
app.get('/api/mindmap', async (req, res) => {
  try {
    const prompt = `Based on the following document, create a structured mind map representing the key concepts.
    Return strictly a JSON object with this exact format without markdown:
    {
      "coreConcept": "Main Topic",
      "branches": [
        {
          "concept": "Sub Topic 1",
          "details": ["Detail 1", "Detail 2"]
        },
        {
          "concept": "Sub Topic 2",
          "details": ["Detail A", "Detail B"]
        }
      ]
    }
    
    DOCUMENT TEXT:
    ${currentDocumentText.substring(0, 30000)}`;

    const responseText = await generateFromOpenRouter(prompt);
    
    let text = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
    const mindmapData = JSON.parse(text);
    
    res.json(mindmapData);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to generate mindmap' });
  }
});

app.listen(port, () => {
  console.log(`Backend server running at http://localhost:${port}`);
});
