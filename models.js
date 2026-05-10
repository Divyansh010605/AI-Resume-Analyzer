require('dotenv').config();
const Groq = require('groq-sdk');
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
groq.models.list().then(m => console.log(m.data.map(x=>x.id))).catch(console.error);
