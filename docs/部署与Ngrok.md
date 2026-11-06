# 部署与 Ngrok 说明

## 环境要求

- Windows 10 或更高版本。
- PowerShell 7。
- Node.js 20 或更高版本。
- Python 3.11 或更高版本。
- Ngrok 3.x。

## 首次准备

```powershell
npm install
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r server\requirements.txt
ngrok config add-authtoken <本机 Ngrok Token>
```

Ngrok Token 只写入本机配置，不进入项目目录。

## 一键启动

仅使用本地语义：

```powershell
.\scripts\start-demo.ps1
```

启用 Pollinations 免费公共模型：

```powershell
.\scripts\start-demo.ps1 -UseFreeLlm
```

只启动本地前后端，不建立公网隧道：

```powershell
.\scripts\start-demo.ps1 -NoTunnel
```

脚本会检查端口、虚拟环境和 Ngrok 配置，启动 FastAPI 与 Vite，等待服务健康后创建隧道，并把公网地址写入：

```text
output/deploy/demo-url.txt
```

## 停止

```powershell
.\scripts\stop-demo.ps1
```

停止脚本只结束 `output/deploy/runtime.json` 中记录的子进程，不会关闭其他终端已有的服务。

## 手动启动

```powershell
npm run dev:api
npm run dev
ngrok http 4173
```

本地地址为 `http://127.0.0.1:4173`。Ngrok 提供公开 HTTPS 地址，并把请求转发到 Vite，Vite 再代理 `/api` 到 FastAPI。

## 故障排查

- `4173` 被占用: 停止旧 Vite 进程，或让脚本复用已运行服务。
- `8000` 被占用: 检查是否有旧 FastAPI 进程仍在运行。
- Ngrok 返回认证错误: 重新执行 `ngrok config add-authtoken`。
- 免费模型超时: 系统会自动回退本地语义路由，不影响演示。
- 页面没有 API 数据: 确认 `npm run dev` 的 `/api` 代理与 FastAPI 端口一致。
