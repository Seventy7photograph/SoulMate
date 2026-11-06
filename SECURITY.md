# 安全说明

## 报告问题

请通过 GitHub 仓库的私密安全报告功能提交安全问题，不要在公开 Issue 中粘贴密钥、个人信息或可复现的生产环境凭据。

## 安全边界

- 浏览器代码不包含模型密钥。
- 模型密钥只允许通过服务端环境变量注入。
- `.env`、SQLite、日志、运行记录、Ngrok 配置和本地测试产物不进入 Git。
- 远程模型响应会经过情绪、动作、长度和置信度白名单归一化。
- 默认模式为本地语义路由，不发送聊天文本到第三方。
- 启用 Pollinations、Gemini 或兼容接口时，用户文本会发送给相应提供方。
- 公网演示环境不应输入真实姓名、电话、账号、财务或医疗信息。

## 公开仓库检查

提交前至少完成：

```powershell
npm audit --omit=dev
npm run test
npm run test:api
npm run build
```

项目维护者应在 GitHub 仓库启用 Secret Scanning 和 Dependabot alerts。
