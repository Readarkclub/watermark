# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

基于 React + Vite + TypeScript 的视频水印移除工具。使用 Google Gemini 2.5 Flash 模型通过 AI 识别和移除视频帧中的水印。

## Development Commands

```bash
npm install      # 安装依赖
npm run dev      # 启动开发服务器 (0.0.0.0:3000)
npm run build    # 构建生产版本
npm run preview  # 预览生产构建
```

## Environment Setup

在 `.env.local` 中设置 `GEMINI_API_KEY`，Vite 会在构建时注入为 `process.env.GEMINI_API_KEY`。

## Architecture

### 单文件应用 (`index.tsx`)

**AnnotationEditor 组件** (`index.tsx:26-131`)
- Canvas 交互式标注编辑器
- `getScaledCoords()` 处理画布显示尺寸与原始图像像素的坐标映射

**App 主组件** (`index.tsx:135+`)
- 工作流：上传视频 → 捕获帧 → 标注水印区域 → AI 处理 → 显示/下载结果

### API 集成 (`handleRemoveWatermark`)

使用 `@google/genai` SDK 直接调用 Google Gemini API：
```typescript
import { GoogleGenAI, Modality } from '@google/genai';
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
```

模型：`gemini-2.5-flash-preview-05-20`，使用 `responseModalities: [Modality.IMAGE, Modality.TEXT]` 返回处理后的图像。

响应结构：`response.candidates[0].content.parts` 中的 `inlineData.data` 包含 base64 图像数据。

### 视频生成 (`generateVideoFromImage`)

将静态图像转换为 1 秒 WebM 视频用于展示，使用 MediaRecorder API 录制 Canvas 流。

## Important Notes

- 无测试配置
- 环境变量通过 Vite `define` 在构建时注入（非运行时）
- 路径别名：`@` → 项目根目录
