const { GoogleGenerativeAI } = require('@google/generative-ai');

const apiKey = "AIzaSyBwb26YF603BDmGLK7M0Wyq3Ka-OzASp4s";
const genAI = new GoogleGenerativeAI(apiKey);

async function listModels() {
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    const data = await response.json();
    console.log("AVAILABLE MODELS:");
    data.models.forEach(m => console.log(m.name, " - Supported methods:", m.supportedGenerationMethods.join(", ")));
  } catch (err) {
    console.error("Error fetching models:", err);
  }
}

listModels();
