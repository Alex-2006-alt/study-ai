# StudyBrain AI - Learning Platform

<div align="center">
  <p>Master your studies with Artificial Intelligence</p>
</div>

StudyBrain AI is a modern web application designed to help students and professionals optimize their learning. By simply uploading your notes (PDFs), StudyBrain uses advanced AI to generate summaries, interactive flashcards, quizzes, and even mindmaps, helping you perfect your knowledge before exams.

## ✨ Features

- **📄 Document Parsing**: Upload PDF notes to be automatically parsed and analyzed.
- **📝 AI Summaries**: Get concise and accurate summaries of your lengthy study materials.
- **🃏 Interactive Flashcards**: Auto-generate flashcards for active recall and spaced repetition.
- **🧠 AI Quizzes**: Test your knowledge with dynamically generated quizzes based on your notes.
- **💬 AI Chat Assistant**: Chat directly with your notes to ask specific questions or clarify concepts.
- **📊 Learning Analytics**: Track your progress and study habits.
- **📅 Study Planner**: Organize your study sessions efficiently.
- **🗺️ Mindmaps**: Visualize connections between concepts in your notes.

## 🛠️ Technology Stack

- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **Build Tool**: [Vite](https://vitejs.dev/)
- **Backend**: Node.js, [Express](https://expressjs.com/)
- **AI Integration**: [OpenRouter API](https://openrouter.ai/) (uses free models by default)
- **File Upload & Parsing**: `multer`, `pdf-parse`
- **Icons & Fonts**: Phosphor Icons, Lucide Icons, Google Fonts (Inter, Outfit)

## 🚀 Getting Started

Follow these steps to run StudyBrain AI locally on your machine.

### Prerequisites

- [Node.js](https://nodejs.org/) (v14 or higher recommended)
- npm (comes with Node.js)
- An API key from [OpenRouter](https://openrouter.ai/)

### Installation

1. **Clone the repository** (if applicable) or download the source code.
2. **Navigate to the project directory**:
   ```bash
   cd studybrain-ai
   ```
3. **Install dependencies**:
   ```bash
   npm install
   ```

### Configuration

Create a `.env` file in the root directory of the project and add your OpenRouter API key:

```env
OPENROUTER_API_KEY=your_openrouter_api_key_here
PORT=3000
```

### Running the Application

To start both the backend server and the Vite frontend dev server, run:

```bash
npm run dev
```

Alternatively, to start the production server:
```bash
npm start
```

The application should now be running. By default, Vite will start the frontend on a local port (e.g., `http://localhost:5173`), and the backend will run on `http://localhost:3000`.

## 📂 Project Structure

- `index.html`: Main HTML template for the web app.
- `main.js`: Core frontend logic, UI initialization, and API calls.
- `style.css`: Custom CSS styling with modern design principles.
- `server.js`: Express backend server handling file uploads, API routing, and OpenRouter integration.
- `package.json`: Project dependencies and scripts.
- `vite.config.js`: Vite configuration file.

## 🤝 Contributing

Contributions are welcome! Feel free to open an issue or submit a Pull Request if you'd like to add new features or fix bugs.

## 📄 License

This project is open-source and available under the [MIT License](LICENSE).
