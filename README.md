# PDF Tools

Web 端 PDF 工具：多文件合并、发票金额按类型汇总。

- 前端：Vite + React + TypeScript + Framer Motion
- 后端：Python FastAPI + pypdf + pdfplumber

## 快速开始

### 1. 启动后端

```bash
cd server
python -m venv .venv

# Windows
.\.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

健康检查：<http://127.0.0.1:8000/api/health>

### 2. 启动前端

另开一个终端：

```bash
cd web
npm install
npm run dev
```

浏览器打开：<http://localhost:5173>

开发模式下，前端会把 `/api` 代理到后端 `8000` 端口。

## Docker 部署（推荐）

机器需安装 [Docker](https://docs.docker.com/engine/install/) 和 Docker Compose。阿里云 ECS 可执行：

```bash
curl -fsSL https://get.docker.com | sh
systemctl enable --now docker
```

从 GitHub 拉取并启动：

```bash
git clone https://github.com/Coco1808/pdfTools.git pdf-tools
cd pdf-tools
docker compose up -d --build
```

浏览器访问 `http://服务器IP/`。默认映射 **80** 端口；若被占用：

```bash
PORT=8080 docker compose up -d --build
```

常用命令：

```bash
docker compose ps
docker compose logs -f
docker compose pull   # 无镜像仓库时可省略
docker compose up -d --build   # 代码更新后重新构建
docker compose down
```

安全组放行 `22` 和 `80`（以及你改过的 `PORT`），不要放行后端 `8000`。

### 推送 GitHub 后自动部署

仓库已包含 GitHub Actions：向 `main` 推送后，会把代码传到阿里云 ECS 并执行 `docker compose up -d --build`。服务器不必再访问 GitHub。

**1. 本机生成部署用 SSH 密钥（不要设置密码）**

PowerShell：

```powershell
ssh-keygen -t ed25519 -C "github-deploy" -f $env:USERPROFILE\.ssh\pdftools_deploy -N ""
```

会得到：

- 私钥：`C:\Users\你的用户名\.ssh\pdftools_deploy`
- 公钥：`C:\Users\你的用户名\.ssh\pdftools_deploy.pub`

**2. 把公钥放到服务器**

```bash
# 在 ECS 上执行
mkdir -p ~/.ssh
chmod 700 ~/.ssh
echo "这里粘贴公钥整行" >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

**3. 阿里云安全组**

`22` 需允许 GitHub Actions 连入。最简单是 `22` 对 `0.0.0.0/0` 放行，并**只允许密钥登录、关闭密码登录**。

**4. 在 GitHub 仓库添加 Secrets**

打开仓库 → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**：

| Name | 值 |
| --- | --- |
| `SERVER_HOST` | ECS 公网 IP |
| `SERVER_USER` | 一般是 `root` |
| `SSH_PRIVATE_KEY` | `pdftools_deploy` **私钥全文**（含 `BEGIN` / `END` 两行） |
| `DEPLOY_PATH` | 可选，默认 `/root/pdf-tools` |

**5. 推送后看部署结果**

把工作流文件提交并推到 `main`。之后每次推送 `main`，在仓库 **Actions** 里查看 `Deploy` 是否成功。也可在 Actions 页手动点 **Run workflow**。

首次部署要等 Docker 构建结束，大约几分钟到十几分钟。


### 国内构建加速

构建慢通常是拉 Docker Hub / PyPI / npm 超时。按顺序做：

**1. 配置阿里云镜像加速器（立刻生效，不必改代码）**

打开 [容器镜像服务](https://cr.console.aliyun.com) → 镜像工具 → 镜像加速器，复制专属地址，在服务器执行：

```bash
mkdir -p /etc/docker
cat >/etc/docker/daemon.json <<'EOF'
{
  "registry-mirrors": [
    "https://你的加速器ID.mirror.aliyuncs.com"
  ]
}
EOF
systemctl daemon-reload
systemctl restart docker
```

**2. 使用仓库里的国内源 Dockerfile**

当前 Compose 默认走 DaoCloud 基础镜像、阿里云 Debian/PyPI、npmmirror。把最新代码拉到服务器后重建：

```bash
cd pdf-tools
git pull
docker compose build --progress=plain
docker compose up -d
```

若加速镜像不可用，可改回官方源：

```bash
PYTHON_IMAGE=python:3.12-slim \
NODE_IMAGE=node:20-alpine \
NGINX_IMAGE=nginx:1.27-alpine \
NPM_REGISTRY=https://registry.npmjs.org \
PIP_INDEX=https://pypi.org/simple \
docker compose up -d --build
```


## 功能

| 页面 | 路径 | 说明 |
| --- | --- | --- |
| 首页 | `/` | 品牌与功能入口 |
| PDF 合并 | `/merge` | 拖拽上传、排序、合并下载 |
| PDF 拆分 | `/split` | 按页码范围或每 N 页拆分，ZIP 下载 |
| PDF 压缩 | `/compress` | 高质量 / 均衡 / 强力压缩 |
| 添加水印 | `/watermark` | 文字水印，透明度/角度/平铺可调 |
| 替换页面 | `/replace` | 指定页码，用另一 PDF 的页面替换 |
| 转可复制 | `/textable` | 扫描件 OCR / 提取文字，生成可复制 PDF |
| 生成目录 | `/toc` | 自动识别标题并插入可点击目录与书签 |
| 发票汇总 | `/invoice` | 识别金额/类型、人工修正、按类型合计、导出 CSV |
| 图片转 PDF | `/images-to-pdf` | 多张图片按顺序合成一份 PDF |
| PDF 转图片 | `/pdf-to-images` | 将每一页导出为 PNG / JPG，多页打包 ZIP |
| 变量起名 | `/naming` | 中文含义译成英文，生成常用变量/方法名并一键复制 |
| JSON 工具 | `/json` | 格式化 JSON，提取键名、值、路径或指定字段 |
| Markdown 编辑器 | `/markdown` | 分栏编辑与实时预览，支持保存/打开 .md |

## 限制

- 单次最多 20 个文件
- 单文件 ≤ 500MB，合计 ≤ 500MB
- PDF 转图片单次最多 80 页
- 发票识别首期面向文本型 / 电子发票 PDF；扫描件可手动补录

## 目录

```
pdf-tools/
├── web/          # 前端
├── server/       # 后端
└── 需求文档.md
```
