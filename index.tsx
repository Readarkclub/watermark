/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom/client';

interface Annotation {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface ImageData {
  dataUrl: string;
  width: number;
  height: number;
  annotation: Annotation | null;
}

const AnnotationEditor = ({ image, onAnnotate }: { image: ImageData; onAnnotate: (a: Annotation) => void }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPoint, setStartPoint] = useState({ x: 0, y: 0 });

  const getScaledCoords = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const rect = canvas?.getBoundingClientRect();
    const img = imageRef.current;
    if (!img || !canvas || !rect) return { x: 0, y: 0 };

    const scaleX = canvas.width / img.offsetWidth;
    const scaleY = canvas.height / img.offsetHeight;

    return {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY,
    };
  };

  const handleMouseDown = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const coords = getScaledCoords(event);
    setStartPoint(coords);
    setIsDrawing(true);
  };

  const handleMouseMove = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const endPoint = getScaledCoords(event);
    draw(startPoint, endPoint);
  };

  const handleMouseUp = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    setIsDrawing(false);
    const endPoint = getScaledCoords(event);
    const annotation: Annotation = {
      x: Math.min(startPoint.x, endPoint.x),
      y: Math.min(startPoint.y, endPoint.y),
      width: Math.abs(startPoint.x - endPoint.x),
      height: Math.abs(startPoint.y - endPoint.y),
    };
    onAnnotate(annotation);
  };

  const draw = (start: { x: number; y: number }, end: { x: number; y: number }, annotation?: Annotation) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx || !canvas) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const rect = annotation || {
      x: Math.min(start.x, end.x),
      y: Math.min(start.y, end.y),
      width: Math.abs(start.x - end.x),
      height: Math.abs(start.y - end.y),
    };

    if (rect.width > 0 && rect.height > 0) {
      ctx.strokeStyle = '#4a90e2';
      ctx.lineWidth = 4;
      ctx.setLineDash([10, 5]);
      ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
      ctx.setLineDash([]);
    }
  };

  useEffect(() => {
    const img = imageRef.current;
    const canvas = canvasRef.current;
    if (img && canvas) {
      const setCanvasSize = () => {
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        if (image.annotation) {
          draw({ x: 0, y: 0 }, { x: 0, y: 0 }, image.annotation);
        } else {
          const ctx = canvas.getContext('2d');
          ctx?.clearRect(0, 0, canvas.width, canvas.height);
        }
      };

      if (img.complete) {
        setCanvasSize();
      } else {
        img.onload = setCanvasSize;
      }
    }
  }, [image]);

  return (
    <div className="annotation-editor">
      <img ref={imageRef} src={image.dataUrl} alt="Image for annotation" />
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => setIsDrawing(false)}
      />
    </div>
  );
};

const App = () => {
  const [sourceImage, setSourceImage] = useState<ImageData | null>(null);
  const [processedImageUrl, setProcessedImageUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      const img = new Image();
      img.onload = () => {
        setSourceImage({
          dataUrl,
          width: img.naturalWidth,
          height: img.naturalHeight,
          annotation: null,
        });
        setProcessedImageUrl(null);
        setError(null);
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  const handleAnnotate = (annotation: Annotation) => {
    if (sourceImage) {
      setSourceImage({ ...sourceImage, annotation });
    }
  };

  const handleRemoveWatermark = async () => {
    if (!sourceImage || !sourceImage.annotation) {
      setError('请先上传图片并标记水印区域');
      return;
    }

    setIsLoading(true);
    setProcessedImageUrl(null);
    setError(null);

    try {
      const { annotation, dataUrl } = sourceImage;
      const base64Data = dataUrl.split(',')[1];

      const prompt = `You are an image inpainting tool. I have marked a rectangular region in this image that contains unwanted text/logo overlay. The marked region is at pixel coordinates: top-left corner (${Math.round(annotation.x)}, ${Math.round(annotation.y)}), size ${Math.round(annotation.width)}x${Math.round(annotation.height)} pixels.

Please generate a new version of this EXACT same image with the SAME dimensions, but with the content inside that marked rectangle replaced by a natural continuation of the surrounding background. The rest of the image must remain EXACTLY the same. Output only the edited image.`;

      const response = await fetch('/api/gemini/v1beta/models/gemini-2.5-flash-image:generateContent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: prompt },
              { inlineData: { mimeType: 'image/jpeg', data: base64Data } },
            ],
          }],
          generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `API 请求失败: ${response.status}`);
      }

      const data = await response.json();
      const parts = data.candidates?.[0]?.content?.parts;

      if (!parts) {
        throw new Error('API 未返回有效响应');
      }

      const imagePart = parts.find((part: any) => part.inlineData?.data);

      if (!imagePart?.inlineData) {
        const textPart = parts.find((part: any) => part.text);
        throw new Error(`API 未返回图片。响应内容: ${textPart?.text || '无'}`);
      }

      const mimeType = imagePart.inlineData.mimeType || 'image/png';
      setProcessedImageUrl(`data:${mimeType};base64,${imagePart.inlineData.data}`);
    } catch (err: any) {
      console.error('Error:', err);
      const message = err?.message || '未知错误';

      if (message.includes('429') || message.includes('quota') || message.includes('RESOURCE_EXHAUSTED')) {
        setError('API 配额已用完，请稍后重试');
      } else if (message.includes('401') || message.includes('403') || message.includes('API_KEY')) {
        setError('API 密钥无效，请检查配置');
      } else {
        setError(`错误: ${message}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const isProcessDisabled = !sourceImage?.annotation || isLoading;

  return (
    <div className="container">
      <h1>图片水印移除工具</h1>
      <p className="description">上传图片，标记水印区域，AI 自动移除水印</p>

      <div className="controls">
        <div className="input-group">
          <label>1. 上传图片</label>
          <input type="file" accept="image/*" onChange={handleFileChange} />
        </div>

        {sourceImage && (
          <div className="input-group">
            <label>2. 在图片上框选水印区域</label>
            <AnnotationEditor image={sourceImage} onAnnotate={handleAnnotate} />
          </div>
        )}

        <button onClick={handleRemoveWatermark} disabled={isProcessDisabled}>
          {isLoading ? '处理中...' : '3. 移除水印'}
        </button>
      </div>

      {isLoading && (
        <div className="loading">
          <div className="spinner"></div>
          <p>AI 正在处理图片，请稍候...</p>
        </div>
      )}

      {error && <p className="error">{error}</p>}

      {processedImageUrl && (
        <div className="results">
          <div className="frame-container">
            <h2>处理结果</h2>
            <div className="processed-output">
              <img src={processedImageUrl} alt="Processed" style={{ maxWidth: '100%' }} />
              <a href={processedImageUrl} download="no-watermark.png" className="download-button">
                下载图片
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(<App />);
