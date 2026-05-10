# ResumeIQ 🧠

**Enterprise-Grade AI Resume Analysis & Intelligence Engine**

ResumeIQ is a professional, full-stack resume analysis platform powered by a dual-engine AI architecture. It leverages the blazing-fast capabilities of **Groq (Llama 3)** for strict ATS simulation and the deep reasoning of **Google Gemini** for qualitative linguistic feedback.

---

## ✨ Features

- **Dual-Engine AI Architecture:**
  - **Groq (Llama 3.3)**: Simulates enterprise Applicant Tracking Systems (ATS) for high-speed keyword gap analysis and formatting diagnostics.
  - **Google Gemini (2.5 Flash)**: Conducts deep, qualitative linguistic analysis—scoring impact, writing tone, and generating actionable suggestions.
- **Privacy-First Parsing:** Resumes (PDF & DOCX) are parsed entirely **client-side** in your browser using `pdf.js` and `mammoth`. Only the extracted raw text is sent to the AI API, protecting metadata.
- **Enterprise UI / UX:** A sleek, glassmorphism-inspired dark mode dashboard designed with a seamless Single-Page Application (SPA) flow.
- **Hardened Backend:** The Node/Express API is secured with `helmet`, `express-rate-limit`, and strict `cors` configurations to prevent abuse.

---

## 🚀 Quick Start

### 1. Clone the Repository
```bash
git clone https://github.com/yourusername/resume-analyzer.git
cd resume-analyzer
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment Variables
Copy the provided example `.env` file:
```bash
cp .env.example .env
```
Open `.env` and add your API keys:
- Get your **Gemini API Key** from [Google AI Studio](https://aistudio.google.com/app/apikey)
- Get your **Groq API Key** from [Groq Console](https://console.groq.com/keys)

### 4. Run the Application
```bash
node server.js
```
The server will start securely. Open your browser and navigate to:
**`http://localhost:3000`**

---

## 🛠 Tech Stack

**Frontend:**
- HTML5 / CSS3 (Modern Flexbox/Grid, CSS Variables)
- Vanilla JavaScript (Async/Await, DOM Manipulation)
- [Lucide Icons](https://lucide.dev/)
- [PDF.js](https://mozilla.github.io/pdf.js/) & [Mammoth.js](https://github.com/mwilliamson/mammoth.js) (Local Parsing)

**Backend:**
- Node.js & Express.js
- `@google/generative-ai` (Gemini SDK)
- `groq-sdk` (Groq SDK)
- Security: `helmet`, `express-rate-limit`, `cors`

---

## 🔒 Security Architecture

- **Rate Limiting:** Prevents API abuse by capping IP requests (20 requests / 15 minutes).
- **Helmet Protection:** Sets strict HTTP headers to mitigate XSS, clickjacking, and mime-sniffing.
- **CORS Restricted:** Cross-Origin Resource Sharing is locked down to prevent unauthorized domain access.
- **Ignored Secrets:** `.gitignore` actively prevents your `.env` keys and `node_modules` from being pushed to source control.

---

## 📝 License
This project is open-source and available under the MIT License.
