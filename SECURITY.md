# 安全与隐私

## 报告问题

请通过 GitHub 仓库的私密安全报告功能提交问题，不要在公开 Issue 中粘贴密钥、个人信息或生产凭据。

## 信任边界

- 默认 `LLM_PROVIDER=local`，聊天文本只在本机处理。
- 启用 Pollinations、Gemini 或远程 OpenAI 兼容接口后，聊天文本会发送给对应服务方。
- 模型密钥只允许通过服务端环境变量注入，浏览器端禁止使用 `VITE_*` 保存密钥。
- 远程模型响应必须经过 JSON 校验、字段白名单、回复长度和置信度归一化。
- 模型超时、限流、返回非 JSON 或非法状态时，服务端回退到本地语义规则。

## 本地数据

- 角色偏好和互动事件保存在 `AOLINU_DB_PATH` 指向的 SQLite 数据库。
- 自定义形象保存在浏览器 `localStorage`。
- 语音识别由浏览器提供，应用不保存或上传音频。
- 实时天气需要用户主动开启，并只向 Open-Meteo 发送经纬度。
- `.env`、数据库、日志、虚拟环境、依赖目录和测试产物均不进入 Git。

## 提交前检查

```powershell
npm audit
npm run lint
npm run typecheck
npm run test
npm run test:api
npm run build
```

公开仓库后，建议启用 GitHub Secret Scanning 和 Dependabot alerts。
