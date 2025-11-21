export default async function handler(req, res) {
  // 1. Securely get the key from Vercel Environment Variables
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'Server configuration error: API Key missing' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { prompt, systemInstruction } = req.body;

  try {
    // 2. Call Google Gemini from the server
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        systemInstruction: { parts: [{ text: systemInstruction }] },
        generationConfig: { responseMimeType: "application/json" }
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.message || response.statusText);
    }

    // 3. Return the result to your frontend
    res.status(200).json(data);
  } catch (error) {
    console.error("Backend API Error:", error);
    res.status(500).json({ error: error.message });
  }
}