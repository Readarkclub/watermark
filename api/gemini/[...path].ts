import type { VercelRequest, VercelResponse } from '@vercel/node';

// Cloudflare Worker 代理地址
const CLOUDFLARE_PROXY = 'https://readark.club/api';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // Handle OPTIONS request (Preflight)
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: { message: 'Method not allowed' } });
  }

  // Extract the path after /api/gemini/
  const pathSegments = req.query.path;
  const apiPath = Array.isArray(pathSegments) ? pathSegments.join('/') : pathSegments || '';

  // 转发到 Cloudflare Worker 代理，Worker 会自动添加 API Key
  const targetUrl = `${CLOUDFLARE_PROXY}/${apiPath}`;

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
    console.error('Cloudflare proxy error:', error);
    return res.status(500).json({
      error: { message: error.message || 'Failed to proxy request to Cloudflare Worker' },
    });
  }
}
