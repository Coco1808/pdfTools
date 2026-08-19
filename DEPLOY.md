# PDF Tools 自动化部署

从零开始：本机推 `main` → GitHub Actions 打包 → SSH/SCP 传到阿里云 ECS → `docker compose` 构建并启动。

服务器**不访问 GitHub**。国内 ECS 直连 GitHub 经常 `Connection was reset`，所以不用 `git clone` / `git pull`。

## 架构

```
本机 git push origin main
        │
        ▼
GitHub Actions (ubuntu)
  1. checkout
  2. tar 打包（不含 .git / node_modules）
  3. scp 传到 ECS:/tmp/pdf-tools.tgz
  4. ssh：解压到 /home/admin/pdf-tools，执行 docker compose up -d --build
        │
        ▼
阿里云 ECS
  docker compose
    web  :80  nginx（静态页 + 反代 /api）
    api  仅容器内 8000，不对公网开放
```

浏览器访问 `http://服务器公网IP/`。前后端同域，不必改 CORS。

工作流文件：`.github/workflows/deploy.yml`

---

## 0. 清空旧部署密钥（已在本机做过）

本机 `pdftools_deploy` / `pdftools_deploy.pub` 已删除。GitHub Secret 里的旧 `SSH_PRIVATE_KEY` 作废，必须换成新密钥。

**服务器上**用阿里云网页终端登录（Workbench / VNC），避免把自己锁在外面。以 **admin** 执行：

```bash
# 只重建部署用的 authorized_keys，不要在没网页终端时执行
mkdir -p ~/.ssh
chmod 700 ~/.ssh
# 清空旧公钥（之后第 2 步会写入新的）
: > ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

若当前只能密钥登录、且没有网页终端，**先不要清空**，等新公钥写入后再删旧行。

---

## 1. 本机生成新密钥（无密码）

PowerShell：

```powershell
ssh-keygen -t ed25519 -C "github-deploy" -f "$env:USERPROFILE\.ssh\pdftools_deploy" -N '""'
```

得到：

| 文件 | 用途 |
| --- | --- |
| `%USERPROFILE%\.ssh\pdftools_deploy` | **私钥**，只进 GitHub Secret，不要提交仓库 |
| `%USERPROFILE%\.ssh\pdftools_deploy.pub` | **公钥**，只放到服务器 `authorized_keys` |

查看公钥：

```powershell
Get-Content "$env:USERPROFILE\.ssh\pdftools_deploy.pub"
```

---

## 2. 公钥写入 ECS（admin）

GitHub Secret 的 `SERVER_USER` 必须是 `admin`，公钥就必须进 **`/home/admin/.ssh/authorized_keys`**。写到 root 家目录里，Actions 连不上。

在 ECS 网页终端（先 `whoami`，应显示 `admin`）：

```bash
whoami
mkdir -p ~/.ssh
chmod 700 ~/.ssh
cat > ~/.ssh/authorized_keys <<'EOF'
这里粘贴公钥整行（ssh-ed25519 AAAA... github-deploy）
EOF
chmod 600 ~/.ssh/authorized_keys
chown -R admin:admin ~/.ssh
```

是一个 `>`（覆盖），不要 `>>`（追加），避免残留旧钥匙。

本机验证（第一次会自动接受主机指纹）：

```powershell
ssh -i "$env:USERPROFILE\.ssh\pdftools_deploy" -o StrictHostKeyChecking=accept-new admin@你的公网IP "echo ok"
```

输出 `ok` 再继续。失败时看文末「排障」。

---

## 3. 阿里云安全组

入方向至少：

| 端口 | 对象 | 说明 |
| --- | --- | --- |
| 22 | `0.0.0.0/0` | GitHub Actions IP 不固定，需放开；服务器只允许密钥登录 |
| 80 | `0.0.0.0/0` | 网站 |

不要放行 **8000**。后端只给 nginx 容器访问。

建议关闭密码登录（密钥验证通过之后）：

```bash
sudo sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
sudo systemctl reload sshd
```

---

## 4. ECS 安装 Docker（只做一次）

```bash
sudo curl -fsSL https://get.docker.com | sudo sh
sudo systemctl enable --now docker
sudo usermod -aG docker admin
```

**必须重新登录 SSH**（或网页终端重开一次），`admin` 才能免 sudo 跑 Docker。验证：

```bash
whoami          # admin
docker compose version
docker ps
```

若提示 `permission denied` 访问 `/var/run/docker.sock`，说明还没进 docker 组或没重新登录。

可选：阿里云镜像加速，加快以后拉基础镜像。

打开 [容器镜像服务](https://cr.console.aliyun.com) → 镜像工具 → 镜像加速器，把专属地址写入：

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

仓库 Dockerfile 已写死国内源（DaoCloud 基础镜像、阿里云 apt/pypi、npmmirror），一般不必再改。

---

## 5. GitHub Secrets

仓库 → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**。

旧的 `SSH_PRIVATE_KEY` 点进去 **Update**，整段换成新私钥。

| Name | 必填 | 值 |
| --- | --- | --- |
| `SERVER_HOST` | 是 | ECS 公网 IP，例如 `47.116.30.86` |
| `SERVER_USER` | 是 | `admin` |
| `SSH_PRIVATE_KEY` | 是 | 私钥**全文**，含首尾两行 |
| `DEPLOY_PATH` | 否 | 默认 `/home/admin/pdf-tools` |

粘贴私钥（PowerShell）：

```powershell
Get-Content "$env:USERPROFILE\.ssh\pdftools_deploy" -Raw
```

必须包含：

```
-----BEGIN OPENSSH PRIVATE KEY-----
...
-----END OPENSSH PRIVATE KEY-----
```

不要多空格、不要只贴中间一段。Secret 里不要加引号。

---

## 6. 第一次上线

密钥和 Secrets 配好后：

1. 确认 `main` 上已有 `.github/workflows/deploy.yml` 和 `docker-compose.yml`
2. 本机（若走 Clash，给 git 加上代理）：

```powershell
git -c http.proxy=http://127.0.0.1:7890 -c https.proxy=http://127.0.0.1:7890 push origin main
```

3. 打开仓库 **Actions** → **Deploy**，看是否绿勾
4. 也可在 Actions 页点 **Run workflow** 手动跑一次

首次构建要拉镜像、编前端、装 Python 依赖，大约 5～15 分钟。成功后浏览器打开：

```
http://你的公网IP/
```

健康检查：`http://你的公网IP/api/health`

---

## 7. 日常流程

改代码 → 提交 → 推 `main` → 等 Actions 完成。不必登录服务器，不必在 ECS 上 `git pull`。

```powershell
git add -A
git commit -m "说明这次改了什么"
git -c http.proxy=http://127.0.0.1:7890 -c https.proxy=http://127.0.0.1:7890 push origin main
```

并发：同一时间只跑一个生产部署（`concurrency: production-deploy`）。

改端口：在服务器 `/home/admin/pdf-tools` 建 `.env`：

```
PORT=8080
```

安全组同步放行该端口。然后重新跑一次 Deploy，或在服务器执行 `docker compose up -d`。

---

## 8. 服务器常用命令

SSH 登录后：

```bash
cd /home/admin/pdf-tools
docker compose ps
docker compose logs -f --tail=100
docker compose logs -f web
docker compose logs -f api
docker compose restart
docker compose down          # 停站（数据卷 pdf-temp 还在）
docker compose up -d --build # 手动重建
```

不要在 ECS 上 `git clone` 本仓库来更新代码。

---

## 9. 排障

| 现象 | 原因 | 处理 |
| --- | --- | --- |
| Actions：`ssh: no key found` | Secret 为空或不是完整私钥 | 重新粘贴 `SSH_PRIVATE_KEY`，含 BEGIN/END |
| `unable to authenticate ... publickey` | 公钥不在 **admin** 的 `authorized_keys`，或 Secret 与当前公钥不是一对 | 本机 `ssh -i pdftools_deploy admin@IP` 先通；确认 `SERVER_USER=admin` |
| `sed` / 删不掉旧 github-deploy | 那一行没有 `github-deploy` 注释 | `cat ~/.ssh/authorized_keys`，整行删掉后覆盖写入新公钥 |
| `permission denied` docker.sock | `admin` 不在 docker 组 | `sudo usermod -aG docker admin` 后重新登录 |
| 本机 ssh 停在 `Are you sure you want to continue connecting` | 首次连主机 | 用 `-o StrictHostKeyChecking=accept-new`，或输入 `yes` |
| ECS 上 `git clone` / `git pull` 失败 | 国内访问 GitHub 不稳定 | 不要用 git 部署，只用 Actions 传 tar |
| `base name (${NGINX_IMAGE}) should not be blank` | BuildKit 空变量当镜像名 | 已写死镜像，拉最新代码即可 |
| 构建卡在 npm / pip / docker hub | 源超时 | 配阿里云镜像加速；确认用仓库里的国内源 Dockerfile |
| 网站打不开 | 安全组没放 80，或容器没起来 | `docker compose ps`；阿里云放行 80 |
| 上传大文件失败 | nginx / 后端限制 | 仓库已是 500MB + 600s 超时，确认服务器是最新解压的代码 |

本机单独测 SSH（不要走 GitHub）：

```powershell
ssh -i "$env:USERPROFILE\.ssh\pdftools_deploy" -o IdentitiesOnly=yes -v admin@你的公网IP
```

服务器确认公钥：

```bash
whoami
ls -l ~/.ssh/authorized_keys
cat ~/.ssh/authorized_keys
```

应只有一行 `ssh-ed25519 ... github-deploy`。`whoami` 必须是 `admin`。

---

## 10. 安全注意

- 私钥只存在本机 `.ssh` 和 GitHub Actions secrets，**禁止**提交到 git
- 公钥可以公开，可以进服务器
- 生产只暴露 22 和 80
- 部署目录默认 `/home/admin/pdf-tools`，由 Actions 每次覆盖解压
- 丢失私钥：重新走第 1～5 步，更新 Secret，不必改业务代码
