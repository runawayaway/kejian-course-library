# 课间 · 西农课程共享计划

网站：https://runawayaway.github.io/kejian-course-library/

以课程为中心展示西北农林科技大学信息工程学院的公开学习资料，支持搜索、收藏、课程详情、资料索引和 GitHub 投稿。

## 资料来源

来自 [NWAFU-coursework-experimental-report](https://github.com/runawayaway/NWAFU-coursework-experimental-report)。原仓库 README 说明资料由 runawayaway 与学长们共同贡献，供本校本科学生参考，参考前应明确任课教师要求。

本次索引 23 个课程目录、120 组文档，对应课程目录共有 488 个文件。同名 PDF/Word 文件合并展示并保留其他格式入口；代码、数据集和附件从「完整课程目录」访问。网站链接到源仓库，不复制原始报告。所有链接固定到同步时的 commit，保证条目与文件一致。

课程简介依据目录和文件名整理，未逐篇评审报告内容。教师、学期、学分、考核与授课方式未获核实的字段保持未知。课程资料/课程实习仅用于归类，不代表教务的必修/选修分类。课程目录「数据库」「数据库系统概论」「数据库实习」按源仓库分别保留，不擅自合并。

原仓库未声明统一许可证，网站提供原始链接，使用权限以原作者说明为准。修课经验和问答不会从作业报告中虚构生成，等待真实投稿补充。

## 本地运行

Node.js 18 或更高版本，无需第三方依赖：

```sh
npm start
npm run check
```

访问 http://localhost:4173 。按 Ctrl+C 停止。可用环境变量 PORT 调整端口。check 校验 JavaScript、课程字段、来源、commit、原始文件名与资料统计。

## 同步课程资料

安装 GitHub CLI，并完成 `gh auth login`：

```sh
npm run sync
```

脚本通过 GitHub API 获取完整目录树，不下载大文件，生成 `data/courses.js`。课程 ID、简介、标签在 `scripts/sync-coursework.mjs` 维护。发现未知课程目录或目录缺失时停止，要求维护者补充映射，避免漏收录或错误归类。

Windows 默认读取 `C:/Program Files/GitHub CLI/gh.exe`，其他系统使用 PATH 中的 gh，可用环境变量 GH_BIN 覆盖。生成数据可直接复用，不要求访客登录或调用 API。

同步会重建生成文件；若后续添加人工审核的教师信息、经验或问答，应先把人工数据合并逻辑加入同步脚本，避免被覆盖。`materials/` 保留早期原创入门示例，不再作为真实课程资料展示。

## 发布网站

main 保存源码，gh-pages 只保存公开网页。完成修改后：

```sh
npm run deploy
git add .
git commit -m "Update course library"
git push origin main
```

发布脚本校验后将 index.html、assets、data、materials 和 .nojekyll 推送到 gh-pages，并校验远端预期提交，避免覆盖他人同时发布的版本。Pages 设置为 **Deploy from a branch → gh-pages → / (root)**，部署结果在仓库 Actions 查看。

资源使用相对路径，课程使用 hash 路由，支持 Pages 子路径与详情刷新。网站纯静态，浏览不需要 GitHub 账号，不依赖本地电脑运行。

如需改成 Actions 发布，将 `.github/pages-workflow.yml` 移至 `.github/workflows/pages.yml`，使用带 workflow 权限的凭据提交，并将 Pages Source 改为 GitHub Actions。

## 用户贡献

课程页面支持分享资料、修课经验、提问、回答和纠错。表单生成 Markdown，可复制、下载，或打开预填的 [网站仓库 Issue](https://github.com/runawayaway/kejian-course-library/issues)。用户在 GitHub 登录并最终提交，表单不会自动发布。

维护者核实课程、教师、学期、出处与权限后更新数据，审核合并并发布。原始作业的修订优先在资料来源仓库进行，再重新同步。功能问题、索引错误与新增课程建议在网站仓库处理。

收藏和「有帮助」标记保存在当前浏览器，不跨设备同步、不汇总全站数据。没有站内注册、上传、数据库与管理后台；完整在线社区需要独立后端。

## Docker 部署

```sh
docker compose up -d --build
```

访问 http://localhost:8080 。端口占用时可在 PowerShell 先设置 `$env:WEB_PORT='8088'`。本机开发曾使用 8088，避免影响其他服务。

默认镜像 nginx:stable-alpine；拉取失败且本机已有适用版本时可指定：

```sh
docker compose build --build-arg NGINX_IMAGE=nginx:1.28-alpine
docker compose up -d --no-build
```

data、materials 只读绑定宿主机目录，重建容器后仍保留。修改 HTML、CSS、JS 后重建镜像；修改课程数据后刷新即可。可用 `docker compose ps`、`docker compose logs web` 演示服务状态和排错。备份源码、data 和 materials 即可。

## 浏览器验证

启动本地网站后运行 `scripts/browser-check.py`（需要 Python Playwright 与 Chromium），覆盖真实课程搜索、格式与来源链接、收藏、投稿、刷新和手机布局。环境变量 TEST_URL 可切换公网地址，BROWSER_EXECUTABLE 可指定浏览器。截图输出至被 Git 忽略的 artifacts/。
