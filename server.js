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
      "model": "google/gemini-2.0-flash-001",
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

// In-memory store for our prototype
let currentDocumentText = "No document uploaded yet. Please upload a document to get started.";

const USERS_FILE = 'users.json';
if (!fs.existsSync(USERS_FILE)) {
  fs.writeFileSync(USERS_FILE, '[]');
}

const upload = multer({ dest: 'uploads/' });

// 0. Auth API
app.post('/api/auth', (req, res) => {
  try {
    const { name, email } = req.body;
    if (!name || !email) return res.status(400).json({ error: 'Name and email required' });
    
    const users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
    let user = users.find(u => u.email === email);
    
    if (!user) {
      user = { id: Date.now().toString(), name, email, createdAt: new Date() };
      users.push(user);
      fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
    }
    
    res.json({ success: true, user });
  } catch (error) {
    console.error('Auth error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// 1. Upload API
app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    
    // Read PDF
    const dataBuffer = fs.readFileSync(req.file.path);
    const parser = new PDFParse({ data: dataBuffer });
    const data = await parser.getText();
    await parser.destroy();
    
    // Store text
    currentDocumentText = data.text;
    
    // Clean up file
    fs.unlinkSync(req.file.path);
    
    res.json({ success: true, message: 'Document processed successfully', charCount: currentDocumentText.length });
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
    const prompt = `Based on the following document, generate 1 multiple choice question to test the student's understanding.
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

app.listen(port, () => {
  console.log(`Backend server running at http://localhost:${port}`);
});
