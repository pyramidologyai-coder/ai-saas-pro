import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function POST(req: NextRequest) {
  try {
    const { query, context } = await req.json();

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: "GEMINI_API_KEY is missing." }, { status: 500 });
    }

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const systemPrompt = `You are the 'Master AI Agent' (a highly intelligent CTO-level AI assistant) for a multi-tenant SaaS platform called AI SAAS PRO. 
    You provide crisp, professional, and highly insightful financial and operational analysis.
    Current Context Data from Dashboard:
    Industry: ${context?.industryType || 'Unknown'}
    Gross Revenue: $${context?.grossRevenue || 0}
    Net Profit: $${context?.netProfit || 0}
    
    User Query: "${query}"
    
    Instructions:
    1. Answer in Arabic or English based on the user's query language (mostly Arabic).
    2. Be concise, authoritative, and format the response beautifully with short paragraphs.
    3. Use the Context Data to make your analysis sound extremely accurate and data-driven.
    4. If asked about the future (like May 2026), project a realistic 10-15% growth based on current bookings.
    5. Do not output markdown code blocks formatting, just normal markdown text (bolding, lists, etc).`;

    const result = await model.generateContent(systemPrompt);
    const response = await result.response;
    const text = response.text();

    return NextResponse.json({ answer: text });
  } catch (error: any) {
    console.error('AI Agent Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to process query' }, { status: 500 });
  }
}
