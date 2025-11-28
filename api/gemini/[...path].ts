import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: { message: 'GEMINI_API_KEY not configured' } });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: { message: 'Method not allowed' } });
  }

  // Extract the path after /api/gemini/
  const pathSegments = req.query.path;
  const apiPath = Array.isArray(pathSegments) ? pathSegments.join('/') : pathSegments || '';

  const targetUrl = `https://generativelanguage.googleapis.com/${apiPath}?key=${apiKey}`;

  try {
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(req.body),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json(data);
    }

    return res.status(200).json(data);
  } catch (error: any) {
    console.error('Gemini API proxy error:', error);
    return res.status(500).json({
      error: { message: error.message || 'Failed to proxy request to Gemini API' },
    });
  }
}
