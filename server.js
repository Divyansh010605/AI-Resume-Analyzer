const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { GoogleGenerativeAI, SchemaType } = require('@google/generative-ai');
const Groq = require('groq-sdk');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Security Middlewares
app.use(helmet({
    contentSecurityPolicy: false, // Disabling CSP for local development and CDN scripts
    crossOriginEmbedderPolicy: false
}));

// Rate limiting (max 20 requests per 15 minutes per IP)
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, 
    max: 20,
    message: { error: 'Too many requests from this IP, please try again after 15 minutes' }
});
app.use('/api/', limiter);

// Strict CORS
const corsOptions = {
    origin: '*', // In production, restrict this to your exact frontend domain
    methods: ['POST', 'GET'],
    allowedHeaders: ['Content-Type', 'Authorization']
};
app.use(cors(corsOptions));
app.use(express.json({ limit: '2mb' })); // Changed to 2mb to prevent large payload DoS attacks (resumes are text-only)
app.use(express.static('./'));

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// Schema for Gemini
const geminiSchema = {
    type: SchemaType.OBJECT,
    properties: {
        overallScore: { type: SchemaType.INTEGER, description: "Overall score out of 100 based on content quality and impact" },
        grade: { type: SchemaType.STRING, description: "Letter grade A+, A, B, etc." },
        summary: { type: SchemaType.STRING, description: "A brief summary of the resume's qualitative strengths and weaknesses" },
        sectionScores: {
            type: SchemaType.OBJECT,
            properties: {
                summary: { type: SchemaType.INTEGER },
                experience: { type: SchemaType.INTEGER },
                education: { type: SchemaType.INTEGER },
                skills: { type: SchemaType.INTEGER }
            }
        },
        writingQuality: {
            type: SchemaType.ARRAY,
            items: {
                type: SchemaType.OBJECT,
                properties: {
                    aspect: { type: SchemaType.STRING },
                    score: { type: SchemaType.INTEGER, description: "Score out of 10" },
                    feedback: { type: SchemaType.STRING }
                }
            }
        },
        quantification: {
            type: SchemaType.OBJECT,
            properties: {
                score: { type: SchemaType.INTEGER, description: "Score out of 100 for impact/metrics/numbers used" },
                feedback: { type: SchemaType.STRING }
            }
        },
        suggestions: {
            type: SchemaType.ARRAY,
            items: {
                type: SchemaType.OBJECT,
                properties: {
                    priority: { type: SchemaType.STRING, description: "'High', 'Medium', or 'Low'" },
                    text: { type: SchemaType.STRING }
                }
            }
        },
        redFlags: {
            type: SchemaType.ARRAY,
            items: {
                type: SchemaType.OBJECT,
                properties: {
                    issue: { type: SchemaType.STRING },
                    description: { type: SchemaType.STRING }
                }
            }
        },
        highlights: {
            type: SchemaType.ARRAY,
            items: {
                type: SchemaType.OBJECT,
                properties: {
                    point: { type: SchemaType.STRING },
                    description: { type: SchemaType.STRING }
                }
            }
        }
    },
    required: ["overallScore", "grade", "summary", "sectionScores", "writingQuality", "quantification", "suggestions", "redFlags", "highlights"]
};

// Groq doesn't use SchemaType in the same way, we enforce via prompt
const groqPromptTemplate = `You are an expert ATS (Applicant Tracking System) simulator.
Analyze the following resume against the target industry and job description.

Extract the requested data and output ONLY a valid JSON object with the following exact structure:
{
  "detectedIndustry": "string",
  "detectedRole": "string",
  "atsScore": number (0-100),
  "atsDetails": [
    { "criterion": "string", "status": "Pass" | "Warning" | "Fail", "comment": "string" }
  ],
  "skillsMatch": number (0-100),
  "missingKeywords": ["string"],
  "presentKeywords": ["string"]
}

Resume Text:
{RESUME_TEXT}

Target Industry: {INDUSTRY}
Target Job Description: {JOB_DESC}`;

app.post('/api/analyze', async (req, res) => {
    try {
        const { resumeText, jobDescription, industry } = req.body;

        if (!resumeText) {
            return res.status(400).json({ error: 'Resume text is required' });
        }

        const targetIndustry = industry !== 'auto' ? industry : 'Infer from resume';
        const targetJD = jobDescription || 'None provided. Evaluate against general industry standards.';

        // --- 1. GROQ ANALYSIS (ATS & Keywords) ---
        const groqPromise = groq.chat.completions.create({
            messages: [
                {
                    role: "system",
                    content: "You are a precise ATS scoring system. Always return valid JSON."
                },
                {
                    role: "user",
                    content: groqPromptTemplate
                        .replace('{RESUME_TEXT}', resumeText)
                        .replace('{INDUSTRY}', targetIndustry)
                        .replace('{JOB_DESC}', targetJD)
                }
            ],
            model: "llama-3.3-70b-versatile", // Updated to supported Groq model
            response_format: { type: "json_object" },
            temperature: 0.1
        }).catch(err => {
            console.error("Groq API Error:", err);
            return null; // Handle error gracefully
        });

        // --- 2. GEMINI ANALYSIS (Qualitative & Deep Writing Analysis) ---
        const geminiModel = genAI.getGenerativeModel({ 
            model: "gemini-2.5-flash", // Using Gemini 2.5 flash
            generationConfig: {
                responseMimeType: "application/json",
                responseSchema: geminiSchema,
                temperature: 0.3
            }
        });

        const geminiPrompt = `You are an expert HR recruiter. 
Analyze the following resume thoroughly for qualitative aspects: writing quality, impact/quantification, deep section analysis, overall grade, and actionable suggestions.

Resume Text:
"""
${resumeText}
"""

Target Industry: ${targetIndustry}
Target Job Description: ${targetJD}

Be critical and constructive. Output strictly the requested JSON schema.`;

        const geminiPromise = geminiModel.generateContent(geminiPrompt).catch(err => {
            console.error("Gemini API Error:", err);
            return null; // Handle error gracefully
        });

        // --- RUN SIMULTANEOUSLY ---
        console.log("Starting dual AI analysis...");
        const [groqResponse, geminiResult] = await Promise.all([groqPromise, geminiPromise]);

        // Parse Groq JSON
        let groqData = {
            detectedIndustry: "Unknown", detectedRole: "Unknown", atsScore: 0, atsDetails: [], skillsMatch: 0, missingKeywords: [], presentKeywords: []
        };
        if (groqResponse) {
            const groqDataStr = groqResponse.choices[0]?.message?.content;
            try {
                groqData = { ...groqData, ...JSON.parse(groqDataStr) };
            } catch (e) {
                console.error("Groq JSON parsing failed:", e);
            }
        }

        // Parse Gemini JSON
        let geminiData = {
            overallScore: 0, grade: "N/A", summary: "Failed to analyze qualitative aspects.", sectionScores: { summary:0, experience:0, education:0, skills:0 }, writingQuality: [], quantification: {score:0, feedback:""}, suggestions: [], redFlags: [], highlights: []
        };
        if (geminiResult) {
            const geminiDataStr = geminiResult.response.text();
            try {
                geminiData = { ...geminiData, ...JSON.parse(geminiDataStr) };
            } catch (e) {
                console.error("Gemini JSON parsing failed:", e);
            }
        }

        // --- MERGE DATA ---
        const combinedData = {
            ...groqData,
            ...geminiData
        };

        // If overallScore wasn't accurately calculated, average it with ATS score
        if (combinedData.overallScore && combinedData.atsScore) {
            combinedData.overallScore = Math.round((combinedData.overallScore + combinedData.atsScore) / 2);
        }

        console.log("✅ Analysis complete! Sending intelligence report to frontend.");
        res.json(combinedData);

    } catch (error) {
        console.error('Error analyzing resume:', error);
        res.status(500).json({ error: 'Failed to analyze resume' });
    }
});

app.listen(port, () => {
    console.log(`Dual-Engine Server running at http://localhost:${port}`);
});
