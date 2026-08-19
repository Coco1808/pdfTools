# PDF Tools 自动化部署（完整步骤）

按编号从 1 做到 8。用户是 **admin**（不是 root）。服务器**不要** `git clone` / `git pull`。

## 固定信息

| 项 | 值 |
| --- | --- |
| 登录用户 | `admin` |
| 部署目录 | `/home/admin/pdf-tools` |
| 网站端口 | `80` |
| 公钥位置 | `/home/admin/.ssh/authorized_keys` |
| 工作流 | `.github/workflows/deploy.yml` |
| 仓库 | https://github.com/Coco1808/pdfTools.git |

把下文所有 `你的公网IP` 换成 ECS 公网 IP（例如 `47.116.30.86`）。

## 流程

```
本机 git push origin main
        │
        ▼
GitHub Actions
  打包 → scp 到服务器 /tmp → ssh 解压到 /home/admin/pdf-tools
  → docker compose up -d --build
        │
        ▼
浏览器 http://公网IP/
  nginx :80  静态页 + 反代 /api
  api   只在容器内 :8000，不对外开放
```

---

## 1. 阿里云安全组

ECS 安全组入方向：

| 端口 | 授权对象 | 用途 |
| --- | --- | --- |
| 22 | `0.0.0.0/0` | 本机和 GitHub Actions SSH |
| 80 | `0.0.0.0/0` | 网站 |

不要放行 **8000**。

---

## 2. 本机生成部署密钥（无密码）

PowerShell：

```powershell
ssh-keygen -t ed25519 -C "github-deploy" -f "$env:USERPROFILE\.ssh\pdftools_deploy" -N '""'
Get-Content "$env:USERPROFILE\.ssh\pdftools_deploy.pub"
```

| 文件 | 用途 |
| --- | --- |
| `%USERPROFILE%\.ssh\pdftools_deploy` | 私钥 → 只进 GitHub Secret |
| `%USERPROFILE%\.ssh\pdftools_deploy.pub` | 公钥 → 只进服务器 authorized_keys |

私钥禁止提交到 git。

---

## 3. 公钥写入服务器（必须是 admin）

用阿里云 **Workbench / VNC** 登录，先确认用户：

```bash
whoami
# 必须输出 admin
```

覆盖写入公钥（一个 `>`，不要 `>>`）：

```bash
mkdir -p ~/.ssh
chmod 700 ~/.ssh
cat > ~/.ssh/authorized_keys <<'EOF'
这里粘贴公钥整行（ssh-ed25519 AAAA... github-deploy）
EOF
chmod 600 ~/.ssh/authorized_keys
chown -R admin:admin ~/.ssh
```

若还要用密码登录，且没有网页终端，不要先清空 `authorized_keys`，把新公钥追加进去即可。配通密钥后再删旧行。

---

## 4. 本机验证 SSH

```powershell
ssh -i "$env:USERPROFILE\.ssh\pdftools_deploy" -o StrictHostKeyChecking=accept-new admin@你的公网IP "echo ok"
```

必须输出 `ok`。停在 `Are you sure...` 时输入 `yes`，或确认上面这条带了 `accept-new`。

失败再看文末排障，不要继续配 Secrets。

---

## 5. 服务器安装 Docker（只做一次）

仍用 **admin** 登录：

```bash
sudo curl -fsSL https://get.docker.com | sudo sh
sudo systemctl enable --now docker
sudo usermod -aG docker admin
newgrp docker
docker ps
```

`docker ps` 能跑通（空列表也行）。`groups` 里必须有 `docker`。

当前窗口里刚 `usermod` 时，组不会立刻生效，所以要用 `newgrp docker`，或关掉终端再开一次。

可选，加快拉镜像。打开 [容器镜像服务](https://cr.console.aliyun.com) → 镜像工具 → 镜像加速器：

```bash
sudo mkdir -p /etc/docker
sudo tee /etc/docker/daemon.json >/dev/null <<'EOF'
{
  "registry-mirrors": [
    "https://你的加速器ID.mirror.aliyuncs.com"
  ]
}
EOF
sudo systemctl daemon-reload
sudo systemctl restart docker
```

仓库 Dockerfile 已用国内源（DaoCloud、阿里云 apt/pypi、npmmirror），一般不用改代码。

建议：密钥和 `docker ps` 都通了之后，再关密码登录：

```bash
sudo sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
sudo systemctl reload sshd
```

---

## 6. 配置 GitHub Secrets

仓库 → **Settings** → **Secrets and variables** → **Actions**。

| Name | 必填 | 值 |
| --- | --- | --- |
| `SERVER_HOST` | 是 | ECS 公网 IP |
| `SERVER_USER` | 是 | `admin` |
| `SSH_PRIVATE_KEY` | 是 | 私钥全文 |
| `DEPLOY_PATH` | 否 | 默认 `/home/admin/pdf-tools` |

私钥（PowerShell）：

```powershell
Get-Content "$env:USERPROFILE\.ssh\pdftools_deploy" -Raw
```

必须含首尾两行，Secret 里不要加引号：

```
-----BEGIN OPENSSH PRIVATE KEY-----
...
-----END OPENSSH PRIVATE KEY-----
```

`SERVER_USER` 填 `root`、或公钥写到 `/root/.ssh`，都会认证失败。

---

## 7. 第一次部署

1. 本机确认已提交 `.github/workflows/deploy.yml`、`docker-compose.yml`
2. 推送到 `main`（本机走 Clash 时加上代理）：

```powershell
git add -A
git commit -m "chore: 自动化部署"
git -c http.proxy=http://127.0.0.1:7890 -c https.proxy=http://127.0.0.1:7890 push origin main
```

3. 打开 GitHub → **Actions** → **Deploy**，等绿勾（首次 5～15 分钟）
4. 也可在 Actions 页点 **Run workflow** 手动跑

成功后访问：

- 网站：`http://你的公网IP/`
- 健康检查：`http://你的公网IP/api/health`

---

## 8. 以后每次发版

改代码 → 提交 → 推 `main` → 等 Actions。不必登录服务器，不必在 ECS 上 git。

```powershell
git add -A
git commit -m "说明这次改了什么"
git -c http.proxy=http://127.0.0.1:7890 -c https.proxy=http://127.0.0.1:7890 push origin main
```

同一时间只跑一个生产部署。

---

## 服务器常用命令

```bash
cd /home/admin/pdf-tools
docker compose ps
docker compose logs -f --tail=100
docker compose logs -f web
docker compose logs -f api
docker compose restart
docker compose down
docker compose up -d --build
```

改网站端口：在 `/home/admin/pdf-tools/.env` 写 `PORT=8080`，安全组放行该端口，再部署一次。

---

## 排障

| 现象 | 原因 | 处理 |
| --- | --- | --- |
| `ssh: no key found` | Secret 不是完整私钥 | 重新粘贴，含 BEGIN/END |
| `unable to authenticate ... publickey` | 公钥不在 **admin** 家目录，或钥匙不成对 | 本机第 4 步先通；`SERVER_USER=admin` |
| `permission denied` docker.sock | 不在 docker 组，或当前会话没刷新 | `sudo usermod -aG docker admin` 然后 `newgrp docker`，再 `docker ps` |
| 本机 ssh 问 `continue connecting` | 首次连这台主机 | `-o StrictHostKeyChecking=accept-new` 或输入 yes |
| ECS 上 git clone / pull 失败 | 国内访问 GitHub 不稳定 | 不要用 git 部署 |
| `base name (${NGINX_IMAGE}) should not be blank` | 旧 Dockerfile 用了空变量 | 用仓库里写死镜像的 Dockerfile |
| 构建卡住 | Docker Hub / npm / pip 超时 | 配镜像加速器 |
| 网站打不开 | 没放行 80，或容器没起来 | `docker compose ps`；安全组放 80 |
| 上传大文件失败 | 服务器代码不是最新 | 重新跑 Deploy；限制已是 500MB / 600s |

本机排查 SSH：

```powershell
ssh -i "$env:USERPROFILE\.ssh\pdftools_deploy" -o IdentitiesOnly=yes -v admin@你的公网IP
```

服务器核对：

```bash
whoami
groups
ls -l ~/.ssh/authorized_keys
cat ~/.ssh/authorized_keys
docker ps
```

`whoami` = `admin`，`groups` 含 `docker`，`authorized_keys` 有一行 `ssh-ed25519 ... github-deploy`。

---

## 安全

- 私钥只放本机 `.ssh` 和 GitHub Secrets
- 生产只暴露 22 和 80
- 丢了私钥：从第 2 步重新生成，更新服务器公钥和 Secret
- 不要在没网页终端时清空 `authorized_keys`，以免锁死
