# Aether 靈境 前端品牌迁移方案

## 目标

先只做品牌与外观替换，不改业务链路，不碰 `src/core/**` 的接口契约。
目标品牌名：Aether 靈境。

## 改动范围

### 1. 全局品牌层
- `src/app/layout.tsx`
- `src/app/icon.svg`
- 统一站点 `title` / `description`

### 2. 首页层
- `src/app/page.tsx`
- `src/components/landing/header.tsx`
- `src/components/landing/hero.tsx`
- `src/components/landing/footer.tsx`
- `src/components/landing/sections/*`

### 3. 工作区层
- `src/components/workspace/workspace-header.tsx`
- `src/components/workspace/settings/about.md`
- `src/components/workspace/settings/about-content.ts`

### 4. 认证层
- `src/app/(auth)/login/page.tsx`
- `src/app/(auth)/setup/page.tsx`

### 5. 文档 / 博客层
- `src/content/en/*`
- `src/content/zh/*`
- `why-aether` / `deploy-your-own-aether` 文档路由

### 6. 视觉资产层
- `public/images/aether-mark.svg`
- 删除旧的 `public/images/deer.svg`

## 不做的事

- 不改后端接口契约
- 不重写线程、Agent、鉴权主流程
- 保留底层 `deerflow` Python 包路径和 `DeerFlowClient` API 名称
