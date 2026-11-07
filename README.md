# SoulMate

SoulMate 是一个本地优先的 3D 数字陪伴 Web 应用。角色小雅会根据聊天内容切换情绪、动作和场景氛围，并支持文本、语音、快捷互动、实时天气与开发者调试。

项目默认使用本地语义规则，不配置模型密钥也能完整运行；需要更开放的对话能力时，可以在服务端启用远程模型，调用失败后会自动回退到本地规则。

## 功能

- 四套 KayKit 人形角色、RobotExpressive 机械体和自定义图片形象。
- 待机、开心、害羞、难过、困倦、生气六种情绪。
- 待机、跳跃、欢呼、挥手、挥拳、坐下六种动作。
- 海滩、草地、森林、太空四套动态场景。
- 情绪同步影响亮度、色温、遮罩、粒子和环境动效。
- 头部跟随、动作结束回接待机周期、对话气泡和折叠会话历史。
- 浏览器语音识别与语音播报。
- 可选系统时间与 Open-Meteo 实时天气。
- 状态调试、角色外观设置、互动历史和 SQLite 持久化。
- 中英文及表情符号的本地意图识别，远程模型失败时自动回退。

## 技术栈

- 前端：React 19、TypeScript、Vite、Zustand、Framer Motion、Three.js、Lucide。
- 后端：FastAPI、Pydantic、httpx、SQLite。
- 测试：Vitest、Testing Library、Playwright、pytest。
- 3D：KayKit Adventurers、KayKit Character Animations、RobotExpressive。

## 目录

```text
.
├─ src/                 前端界面、状态机、3D 渲染与浏览器回退逻辑
├─ server/              FastAPI、本地语义入口、模型适配与持久化
├─ shared/              前后端共用的聊天意图规则
├─ tests/e2e/           Playwright 端到端测试
├─ public/models/       本地 3D 模型与许可文件
├─ docs/                语义识别与模型资产说明
├─ .github/             CI 与依赖更新配置
└─ README.md
```

## 本地运行

环境要求：

- Node.js 20 或更高版本。
- Python 3.11 或更高版本。
- PowerShell 7。

首次安装：

```powershell
npm install
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r server\requirements.txt
Copy-Item .env.example .env
```

分别启动 API 和前端：

```powershell
npm run dev:api
npm run dev
```

打开 `http://127.0.0.1:4173`。Vite 会把 `/api` 代理到 `http://127.0.0.1:8000`。

## 配置

| 变量 | 默认值 | 说明 |
|---|---|---|
| `VITE_API_BASE` | 空 | 浏览器 API 地址；空值使用 Vite 代理 |
| `LLM_PROVIDER` | `local` | `local`、`pollinations`、`gemini` 或 `openai-compatible` |
| `LLM_BASE_URL` | 空 | OpenAI 兼容接口地址 |
| `LLM_MODEL` | 空 | 模型名称 |
| `LLM_API_KEY` | 空 | 远程接口密钥，仅服务端使用 |
| `GEMINI_API_KEY` | 空 | Gemini 服务端密钥 |
| `GEMINI_MODEL` | 空 | Gemini 模型名称，默认 `gemini-2.5-flash` |
| `AOLINU_DB_PATH` | `server/data/aolinu.db` | SQLite 文件路径 |
| `AOLINU_ALLOWED_ORIGINS` | 本地地址 | 服务端 CORS 白名单 |

密钥只能放在服务端环境变量中，不能使用 `VITE_*` 变量。默认 `local` 模式不会把聊天内容发送到第三方。

OpenAI 兼容接口示例：

```env
LLM_PROVIDER=openai-compatible
LLM_BASE_URL=http://127.0.0.1:11434/v1
LLM_API_KEY=ollama
LLM_MODEL=qwen2.5:7b-instruct
```

## 聊天语义

本地语义规则位于 `shared/companion-intents.json`，前端离线回退和 FastAPI 共用同一份配置。规则按优先级匹配，目前覆盖：

- 问候、重逢、告别、身份与能力询问。
- 亲密表达、感谢、道歉、陪伴请求和日常确认。
- 开心、害羞、难过、焦虑、疲惫、困倦、生气等状态。
- 饮食、睡眠、健康、关系、工作、学习、考试与面试压力。
- 好消息、成就、娱乐、兴趣、天气、无聊、困惑和开放式问题。
- 常见英文表达、缩写、笑声、语气词和表情符号。
- 自伤风险表达的安全回应。

详细规则、优先级和扩展方式见 [docs/语义识别.md](docs/语义识别.md)。

## 测试

```powershell
npm run lint
npm run typecheck
npm run test
npm run test:api
npm run e2e
npm run build
```

CI 会安装前端与后端依赖，并执行 ESLint、TypeScript、Vitest、pytest 和生产构建。

## 安全与隐私

- `.env`、SQLite 数据库、日志和测试产物不进入 Git。
- 浏览器不包含模型密钥。
- 远程模型输出会经过情绪、动作、长度和置信度归一化。
- 语音识别由浏览器处理，应用不保存或上传音频。
- 实时天气仅在用户主动开启后请求定位，并只向 Open-Meteo 发送坐标。
- 自定义图片保存在浏览器 `localStorage`。

完整说明见 [SECURITY.md](SECURITY.md)。

## 模型许可

KayKit Adventurers / Character Animations by Kay Lousberg，CC0 1.0。

RobotExpressive by Tomas Laulhe, modified by Don McCurdy，CC0 1.0。

文件、动作映射和 SHA256 见 [docs/模型资产.md](docs/模型资产.md)。

## 许可

项目代码使用 [MIT License](LICENSE)。
