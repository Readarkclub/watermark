<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1gQseFHvBpjSK3Lj_OisQlnXDwRuJMIdj

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Deploy to Vercel

1. Import the repository to Vercel
2. Configure your Gemini API key injection:
   - Default: `api/gemini/[...path].ts` proxies to `https://readark.club/api` (Cloudflare Worker) which injects the key
   - Alternative: change the proxy to call `https://generativelanguage.googleapis.com` directly and set `GEMINI_API_KEY` in Vercel
3. Deploy
