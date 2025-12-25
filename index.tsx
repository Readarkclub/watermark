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
  annotations: Annotation[];
}

type RepairMode = 'blemish' | 'scratch' | 'object' | 'cleanup';

const REPAIR_MODES: Array<{ value: RepairMode; label: string; hint: string }> = [
  { value: 'blemish', label: '去瑕疵/污渍', hint: '适合痘痘、斑点、灰尘、污渍、小脏点' },
  { value: 'scratch', label: '修复划痕/破损', hint: '适合划痕、撕裂、缺口、老照片修复' },
  { value: 'object', label: '移除小物体', hint: '适合电线、小路人、杂物等（越小越好）' },
  { value: 'cleanup', label: '背景清理', hint: '适合清理局部遮挡并自然补全背景' },
];

const AnnotationEditor = ({ 
  image, 
  onAnnotate 
}: { 
  image: ImageData; 
  onAnnotate: (a: Annotation) => void 
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPoint, setStartPoint] = useState({ x: 0, y: 0 });
  const [currentDragRect, setCurrentDragRect] = useState<Annotation | null>(null);

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
    setCurrentDragRect({ x: coords.x, y: coords.y, width: 0, height: 0 });
  };

  const handleMouseMove = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const endPoint = getScaledCoords(event);
    
    const newRect = {
      x: Math.min(startPoint.x, endPoint.x),
      y: Math.min(startPoint.y, endPoint.y),
      width: Math.abs(startPoint.x - endPoint.x),
      height: Math.abs(startPoint.y - endPoint.y),
    };
    
    setCurrentDragRect(newRect);
    draw(newRect);
  };

  const handleMouseUp = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    setIsDrawing(false);
    setCurrentDragRect(null);
    
    const endPoint = getScaledCoords(event);
    const annotation: Annotation = {
      x: Math.min(startPoint.x, endPoint.x),
      y: Math.min(startPoint.y, endPoint.y),
      width: Math.abs(startPoint.x - endPoint.x),
      height: Math.abs(startPoint.y - endPoint.y),
    };

    // Ignore very small clicks
    if (annotation.width > 5 && annotation.height > 5) {
      onAnnotate(annotation);
    } else {
      // If valid click but too small, just redraw existing
      draw(null);
    }
  };

  const draw = (currentRect: Annotation | null) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx || !canvas) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw existing annotations
    ctx.strokeStyle = '#4a90e2';
    ctx.lineWidth = 3;
    ctx.setLineDash([]);
    
    image.annotations.forEach((rect, index) => {
      ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
      
      // Add label
      ctx.fillStyle = 'rgba(74, 144, 226, 0.2)';
      ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
      
      ctx.fillStyle = '#4a90e2';
      ctx.font = '12px Arial';
      ctx.fillText(`#${index + 1}`, rect.x + 2, rect.y + 14);
    });

    // Draw current dragging rectangle
    if (currentRect && currentRect.width > 0 && currentRect.height > 0) {
      ctx.strokeStyle = '#e24a4a';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.strokeRect(currentRect.x, currentRect.y, currentRect.width, currentRect.height);
    }
  };

  // Re-draw when annotations change
  useEffect(() => {
    const img = imageRef.current;
    const canvas = canvasRef.current;
    
    if (img && canvas) {
      const setCanvasSize = () => {
        // Only set dimensions if they differ to avoid flickering/resetting
        if (canvas.width !== img.naturalWidth || canvas.height !== img.naturalHeight) {
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
        }
        draw(null);
      };

      if (img.complete) {
        setCanvasSize();
      } else {
        img.onload = setCanvasSize;
      }
    }
  }, [image.annotations, image.dataUrl]);

  return (
    <div className="annotation-editor">
      <img ref={imageRef} src={image.dataUrl} alt="Image for annotation" />
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => {
          if (isDrawing) {
            setIsDrawing(false);
            setCurrentDragRect(null);
            draw(null);
          }
        }}
      />
    </div>
  );
};

const App = () => {
  const [sourceImage, setSourceImage] = useState<ImageData | null>(null);
  const [processedImageUrl, setProcessedImageUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [repairMode, setRepairMode] = useState<RepairMode>('blemish');
  const [regionNote, setRegionNote] = useState('');

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
          annotations: [],
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
      setSourceImage({ 
        ...sourceImage, 
        annotations: [...sourceImage.annotations, annotation] 
      });
    }
  };

  const handleUndo = () => {
    if (sourceImage && sourceImage.annotations.length > 0) {
      setSourceImage({
        ...sourceImage,
        annotations: sourceImage.annotations.slice(0, -1)
      });
    }
  };

  const handleClear = () => {
    if (sourceImage) {
      setSourceImage({ ...sourceImage, annotations: [] });
    }
  };

  const handleInpaint = async () => {
    if (!sourceImage || sourceImage.annotations.length === 0) {
      setError('请先上传图片并至少框选一个修复区域');
      return;
    }

    setIsLoading(true);
    setProcessedImageUrl(null);
    setError(null);

    try {
      const { annotations, dataUrl } = sourceImage;
      const inputMimeTypeMatch = dataUrl.match(/^data:(.*?);base64,/);
      const inputMimeType = inputMimeTypeMatch?.[1] || 'image/jpeg';
      const base64Data = dataUrl.split(',')[1];

      // Construct a description for multiple regions
      const regionsDescription = annotations.map((a, i) => 
        `Region ${i + 1}: top-left (${Math.round(a.x)}, ${Math.round(a.y)}), size ${Math.round(a.width)}x${Math.round(a.height)}`
      ).join('\n');

      const modeInstruction: Record<RepairMode, string> = {
        blemish:
          'Remove small blemishes, stains, dust specks, acne, or minor imperfections inside the regions. Preserve natural texture; do not over-smooth.',
        scratch:
          'Repair scratches/tears/damage inside the regions by reconstructing missing texture and structure consistent with the surrounding area.',
        object:
          'Remove the small unwanted object inside the regions and inpaint the background to match the surroundings seamlessly.',
        cleanup:
          'Clean up the marked regions and inpaint them to look natural and consistent with the surrounding background.',
      };

      const note = regionNote.trim();
      const noteLine = note ? `User note about what to remove: ${note}\n` : '';

      const prompt = `Find the following regions in the image:
${regionsDescription}

You are an image restoration and inpainting tool.
${noteLine}${modeInstruction[repairMode]}
Work ONLY inside the specified regions.
Do not modify any other parts of the image.
Do not remove or alter watermarks, logos, signatures, or copyright notices. If the marked area appears to contain any of those, reply with text only explaining you can't help.
Output ONLY the final image.`;

      const response = await fetch('/api/gemini/v1beta/models/gemini-3-pro-image-preview:generateContent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: prompt },
              { inlineData: { mimeType: inputMimeType, data: base64Data } },
            ],
          }],
          generationConfig: { responseModalities: ['TEXT', 'IMAGE'], temperature: 0.2 },
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
      } else if (/watermark|logo|signature|copyright/i.test(message) || /水印|去水印|logo|签名|版权/i.test(message)) {
        setError('模型拒绝处理：无法用于去除水印/Logo/版权标识。请改用合规用途（如去瑕疵、移除小物体、修复破损等）。');
      } else {
        setError(`错误: ${message}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const isProcessDisabled = !sourceImage?.annotations.length || isLoading;

  return (
    <div className="container">
      <h1>图片修复/去瑕疵工具</h1>
      <p className="description">上传图片，框选需要修复的区域，选择修复模式并可补充说明（不支持去水印/Logo/版权标识）。</p>

      <div className="controls">
        <div className="input-group">
          <label>1. 上传图片</label>
          <input type="file" accept="image/*" onChange={handleFileChange} />
        </div>

        {sourceImage && (
          <div className="input-group">
            <label>2. 修复模式</label>
            <select
              value={repairMode}
              onChange={(e) => setRepairMode(e.target.value as RepairMode)}
              disabled={isLoading}
            >
              {REPAIR_MODES.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
            <p className="hint">{REPAIR_MODES.find((m) => m.value === repairMode)?.hint}</p>

            <label>3. 可选说明（会影响修复结果）</label>
            <textarea
              value={regionNote}
              onChange={(e) => setRegionNote(e.target.value)}
              disabled={isLoading}
              placeholder="例如：去掉脸上的痘痘/黑点；修复划痕；移除小电线；修补破损区域…"
              rows={3}
            />
          </div>
        )}

        {sourceImage && (
          <div className="input-group">
            <div className="annotation-header">
              <label>4. 框选修复区域 (已选: {sourceImage.annotations.length})</label>
              <div className="annotation-actions">
                <button 
                  onClick={handleUndo} 
                  disabled={sourceImage.annotations.length === 0 || isLoading}
                  className="secondary-btn"
                >
                  撤销
                </button>
                <button 
                  onClick={handleClear} 
                  disabled={sourceImage.annotations.length === 0 || isLoading}
                  className="secondary-btn"
                >
                  清除所有
                </button>
              </div>
            </div>
            <AnnotationEditor image={sourceImage} onAnnotate={handleAnnotate} />
          </div>
        )}

        <button onClick={handleInpaint} disabled={isProcessDisabled} className="primary-btn">
          {isLoading ? '处理中...' : `5. 修复 ${sourceImage?.annotations.length || 0} 个区域`}
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
              <div className="result-actions">
                <a href={processedImageUrl} download="result.png" className="download-button">
                  下载图片
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(<App />);
