# 课间 · 校园课程资料与经验共享平台

按原始需求文档最后确定的第一版方案实现：**静态课程资料库 + GitHub 协作 + Docker/Nginx 部署**。无需安装第三方依赖。页面适配桌面与手机。

## 本地运行

安装 Node.js 18 或更高版本，在本目录打开终端：

```sh
npm start
```

打开 **http://localhost:4173**。按 Ctrl+C 停止。可用环境变量 PORT 调整端口。不要直接双击打开 HTML，建议始终使用本地服务器。

```sh
npm run check
```

这会检查 JavaScript 语法、课程字段、课程 ID、资料链接格式与本地资料文件。

## 已实现功能

- 按课程名、学院、类型、课程代码、标签搜索，支持类别与学院组合筛选。
- 每门课程拥有独立 hash 路由页面，包含课程介绍、授课信息、资料、经验、问答。
- 每条资料标注来源、分享权限、学期和教师；本地原创资料可直接下载，外部资料打开原始页面。
- 本地收藏课程、标记回答有帮助，刷新后保留。数据仅存当前浏览器，不跨设备同步、不汇总全站点赞。
- 投稿、提问、回答、失效反馈、新增课程建议共用投稿表单，支持生成、复制、下载 Markdown。
- 配置 GitHub 仓库后可打开预填的 Issue 页面；**用户须在 GitHub 登录并最终提交**，表单自身不会自动提交。
- 提供 Issue 模板、GitHub Pages 工作流、Dockerfile、Compose 和 Nginx 配置。

当前为静态版，**没有站内账号、后端数据库、站内上传或管理后台**。原需求前半部分的完整在线社区可作为第二阶段；第一版审核通过 GitHub Issue 和 PR 完成。页面明确说明这些边界，不以本地模拟充当多用户服务。

## 替换真实课程

所有当前课程、教师、学期、考核信息均为**示例**。5 份本地 Markdown 是原创入门示例，外部链接是公开学习资料；不是学校提供的正式资料。

编辑 `data/courses.js` 中的 `COURSES`：

- `id`：唯一的小写英文或数字、连字符，用于课程链接，不要随意改动已有 ID。
- `name / code / college / category / credits`：名称、代码、学院、类型、学分。
- `teacher / semester / assessment / style`：核实后的授课与考核信息。
- `resources`：资料数组。本地文件放 `materials/`；注明来源与分享权限。
- `experiences / questions`：经审核的学习经验与问答。

正式使用时，补充自己学校的真实数据，并同步修改页面上的「示例」提示。当前数据模型每门课包含一组授课信息，不同教师/学期需要扩展为授课记录数组后再录入；不要将不同学期的信息混在一起。

## 开通 GitHub 投稿

在 `data/courses.js` 设置：

```js
window.SITE_CONFIG = {
  name: '课间',
  repository: '你的GitHub用户名/仓库名',
  school: '校园课程共享计划'
};
```

确保仓库开启 Issues。生成投稿后会出现「打开 GitHub 投稿」按钮；未配置仓库时仍能下载文稿。不要在前端放个人访问令牌或任何密码。

维护者处理流程：检查版权、来源、教师学期 → 对照已有课程去重 → 修改课程数据或资料文件 → 运行检查 → 提交 PR → 审核合并 → 关闭 Issue。失效资料先移除或更换，重复课程合并后更新引用。恶意内容在 GitHub 侧处理，无需先进入公开课程数据。

## GitHub Pages 发布

本项目使用 `gh-pages` 分支发布。项目地址：https://github.com/runawayaway/kejian-course-library

1. 在仓库 Settings → Pages → Source 选择 **Deploy from a branch**。
2. Branch 选择 **gh-pages**，目录选择 **/ (root)**，保存。
3. 后续修改网站后运行 `npm run deploy`，将公开文件更新到发布分支。
4. 在仓库 Actions 或 Pages 设置页查看构建与部署结果。

`npm run deploy` 需要 Git 凭据具有该仓库写入权限，仅上传 index.html、assets、data、materials 和 .nojekyll。main 分支保留完整源码，通过 `git push origin main` 同步。发布脚本使用带预期提交校验的推送，避免覆盖别人同时发布的版本。

如以后想改为 Actions 发布，可将 `.github/pages-workflow.yml` 移动到 `.github/workflows/pages.yml`，使用带 workflow 权限的凭据提交，再将 Pages Source 改为 GitHub Actions。当前保留为参考文件，避免要求额外的 workflow 授权。

全部资源使用相对路径，兼容项目子路径；课程使用 hash 路由，刷新详情页也能加载。

## Docker 部署与课程演示

安装并启动 Docker Desktop（Linux containers），运行：

```sh
docker compose up -d --build
docker compose ps
```

打开 **http://localhost:8080**。宿主机端口 8080 映射容器 80，Nginx 提供网页和文件。单服务 Compose 会自动创建项目网络，当前静态版无需数据库及后端容器。

若端口已占用，在 PowerShell 先设置 `$env:WEB_PORT='8088'` 再启动，随后访问 http://localhost:8088 。本次开发验证使用 8088，避免影响原有服务。

如果 Docker Hub 拉取失败，可以用**自己机器已有且适用的 Nginx 镜像**构建，例如本次验证使用本机已有的版本：

```sh
docker compose build --build-arg NGINX_IMAGE=nginx:1.28-alpine
docker compose up -d --no-build
```

默认仍使用 `nginx:stable-alpine`。不要为了镜像下载修改机器的全局 Docker 配置。

```sh
docker compose logs web
docker compose down
docker compose up -d
```

`data/` 和 `materials/` 是只读绑定挂载，文件持久保存在宿主机，容器重建后仍存在。编辑这些目录中的内容无需重建镜像；修改 HTML、CSS、JS 或 Nginx 配置后重新执行带 `--build` 的启动命令。收藏在浏览器内，不在容器里。

备份：保存 `data/`、`materials/` 和仓库代码；恢复时把目录还原后启动 Compose。可以用 PowerShell 压缩资料：

```powershell
Compress-Archive -Path data,materials -DestinationPath course-backup.zip
```

备份文件应保存在项目目录以外的可靠位置。无需数据库备份，因为第一版没有数据库。

## 目录

```text
index.html             页面入口
assets/                样式、交互、图标
data/courses.js         网站配置与课程数据
materials/             原创示例资料
scripts/               本地服务器与数据校验
.github/               Issue 模板与 Pages 工作流
Dockerfile             Nginx 镜像
compose.yaml           容器与目录挂载
nginx.conf             静态服务配置
```

## 后续扩展

如果需要网页内注册、文件上传、多人问答与管理后台，应引入后端、数据库、身份认证、上传校验和权限控制，并使用独立部署，不能只依赖 GitHub Pages。

## 浏览器验证

`scripts/browser-check.py` 是可选的端到端检查，需要 Python 的 Playwright 和 Chromium。启动网站后运行该脚本；环境变量 `TEST_URL` 可切换被测地址，`BROWSER_EXECUTABLE` 可指定本机 Chromium 路径。检查搜索、筛选、收藏持久化、下载、问答标记、投稿、详情刷新及响应式布局，截图写入被 Git 忽略的 `artifacts/`。
