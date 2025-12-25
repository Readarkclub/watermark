# Project Context: Image Inpainting (AI Studio App)

## Overview
This is a React-based web application designed to inpaint (repair) selected regions of an image (e.g. blemish removal, scratch repair, small object removal). The user uploads an image, draws one or more bounding boxes around target areas, optionally adds a short note, and the application requests the AI to generate a repaired version of the image.

Note: Gemini may refuse requests that attempt to remove watermarks/logos/signatures/copyright notices.

## Technology Stack
- **Frontend:** React 19, Vite, TypeScript.
- **Backend/API:**
  - **Local Development:** Vite Proxy (configured in `vite.config.ts`) to forward requests to Google's Generative Language API.
- **Production:** Vercel Serverless Functions (`api/gemini/[...path].ts`) proxying requests to a Cloudflare Worker (`https://readark.club/api`) which injects the API key.
- **AI Model:** Google Gemini image-capable model (currently `gemini-3-pro-image-preview:generateContent`).

## Project Structure
- **`index.tsx`**: The main application logic. Contains:
  - `AnnotationEditor`: A Canvas-based component for drawing bounding boxes on images.
  - `App`: Manages state (image, annotation, loading), handles file uploads, and coordinates the API call to Gemini.
- **`vite.config.ts`**: Configuration for Vite. Crucially, it sets up a proxy for `/api/gemini` to handle CORS and API key injection during local development. It also sets `Cross-Origin-Opener-Policy` and `Cross-Origin-Embedder-Policy` headers.
- **`api/gemini/[...path].ts`**: A Vercel Serverless Function that proxies requests to the Google Gemini API. This ensures the `GEMINI_API_KEY` is not exposed to the client in production.
- **`package.json`**: Lists dependencies. Note that `@ffmpeg/ffmpeg` is listed but currently appears unused in the main `index.tsx` logic, which relies purely on the Gemini API.

## Setup and Running

### Prerequisites
- Node.js
- A Google Gemini API Key

### Installation
```bash
npm install
```

### Local Development
1.  Create a `.env` or `.env.local` file in the root directory.
2.  Add your API key:
    ```env
    GEMINI_API_KEY=your_actual_api_key_here
    ```
3.  Start the development server:
    ```bash
    npm run dev
    ```
    The app will be available at `http://localhost:3000`.

### Build
```bash
npm run build
```

## Key Workflows

### Inpainting Process
1.  **Upload:** User selects an image.
2.  **Annotate:** User draws one or more rectangles on the canvas over regions to repair.
3.  **Request:** The app sends the original image (base64) and a prompt to the `/api/gemini/...` endpoint.
    *   *Prompt:* Instructs the model to act as an inpainting tool and replace the content within the specified pixel coordinates.
4.  **Response:** The model returns the processed image, which is then displayed to the user.

## Important Implementation Details
- **Proxy Pattern:** The application *never* calls the Google API directly from the browser to avoid exposing the API key. It always goes through `/api/gemini`, which is handled by Vite (dev) or Vercel (prod).
- **Canvas Coordinates:** The `AnnotationEditor` handles scaling between the visual size of the image on screen and its natural resolution to ensure the coordinates sent to the AI are accurate.
