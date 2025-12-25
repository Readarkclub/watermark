# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

基于 React + Vite + TypeScript 的图片局部修复（inpainting）工具：上传图片、选择修复模式、框选需要修复的区域，让 Gemini 生成修复后的图像（如去瑕疵、修复划痕、移除小物体）。

注意：Gemini 可能会拒绝涉及去除水印/Logo/签名/版权标识的请求，本项目不以此为用途。

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
- 工作流：上传图片 → 标注修复区域 → AI 处理 → 显示/下载结果

### API 集成 (`handleInpaint`)

前端通过 `fetch('/api/gemini/...')` 调用代理接口，再由代理转发到 Gemini/Cloudflare Worker。

模型：当前使用 `gemini-3-pro-image-preview:generateContent`，并请求 `responseModalities: ['TEXT', 'IMAGE']`。

响应结构：`candidates[0].content.parts` 中的 `inlineData.data` 包含 base64 图像数据。

## Important Notes

- 无测试配置
- 本地开发：`vite.config.ts` 会将 `GEMINI_API_KEY` 注入到代理请求的 query string
- 生产环境：`api/gemini/[...path].ts` 当前转发到 Cloudflare Worker（由 Worker 注入 API Key）
- 路径别名：`@` → 项目根目录
