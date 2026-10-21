# 课间 · 西农课程共享计划

网站：https://runawayaway.github.io/kejian-course-library/

以课程为中心展示西北农林科技大学信息工程学院的公开学习资料，支持搜索、收藏、课程详情、资料索引和 GitHub 投稿。

## 资料来源

来自 [NWAFU-coursework-experimental-report](https://github.com/runawayaway/NWAFU-coursework-experimental-report)。原仓库 README 说明资料由 runawayaway 与学长们共同贡献，供本校本科学生参考，参考前应明确任课教师要求。

本次索引 23 个课程目录、120 组文档，对应课程目录共有 488 个文件。同名 PDF/Word 文件合并展示并保留其他格式入口；代码、数据集和附件从「完整课程目录」访问。网站链接到源仓库，不复制原始报告。所有链接固定到同步时的 commit，保证条目与文件一致。

课程简介依据目录和文件名整理，未逐篇评审报告内容。教师、学期、学分、考核与授课方式未获核实的字段保持未知。课程资料/课程实习仅用于归类，不代表教务的必修/选修分类。课程目录「数据库」「数据库系统概论」「数据库实习」按源仓库分别保留，不擅自合并。

原仓库未声明统一许可证，网站提供原始链接，使用权限以原作者说明为准。修课经验不从作业报告中虚构生成。

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

作业目录在 data/courses.js，修课投稿单独保存在 data/community.json，不会被作业目录重建覆盖。`npm run sync` 同步两者，`npm run sync:community` 仅同步投稿。网站同时尝试直接读取最新 GitHub Issue，提供手动刷新；网络或 API 额度受限时保留发布时的投稿记录。`materials/` 保留早期原创入门示例，不再作为真实课程资料展示。

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

## 简化后的贡献方式

- 添加课程：课程名必填，简介可选。同名课程自动归入已有课程，避免重复卡片。
- 写经验：在课程页只需填写正文，教师、学期可选，保留已有投稿的全部信息。
- 分享资料：只需原始链接，一句说明可选。
- 修改：经验旁点「修改原文」、分享旁点「修改分享」，直接进入原 Issue。作者或维护者在 GitHub 的「⋯ → Edit」修改保存，无需新建投稿或重新填写整套表单。

网站不再展示空问答、点赞、重复的课程介绍和未知学分占位，也移除了「生成文稿 → 复制/下载 → 再打开 GitHub」流程。填完后点「继续到 GitHub」，直接打开预填内容；GitHub 登录和最后一次 Create 确认仍然需要。新增课程、经验和链接都从公开 Issue 读取，不再要求维护者手动修改源代码。

同学添加的课程显示为「同学新增」，未收录的课程和内容标为「待核实」。OWNER 投稿或带「已收录」/approved/accepted 标签的投稿标为已收录；标签「不予收录」/rejected/隐藏会排除该条投稿。课程 ID 依据新增课程的 Issue 编号生成，修改简介不会改变链接。新增课程先解析，随后再关联其经验和资源，同一次刷新即可完整显示。经名称规范化后与已有课程同名的，不生成重复课程。课程名变更时，新版经验中的课程 ID 仍可用于关联。

自动同步：切回网站、网络恢复时检查，页面可见期间每两分钟再检查。无待确认投稿时最短间隔 20 秒，手动刷新不受此间隔影响。原 Issue 的修改会反映到原课程页。当前标签页 sessionStorage 保存待确认投稿，最长一小时；只有读到匹配的新记录才提示同步成功，不把打开 GitHub 当作成功提交。

作业资料保存在 data/courses.js，学生新增课程、经验、资料链接保存在 data/community.json，两者分别维护。网络或访问额度受限时保留已发布快照；其他访客下一次成功同步后即可看到新内容。快照更新需运行 `npm run sync:community` 后发布。

GitHub Pages 静态方案仍需 GitHub 账号投稿。免登录需要独立后端，不能把管理员写入凭据放在浏览器中。收藏保存在当前浏览器，不跨设备同步。原作业修订优先在资料仓库进行。

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
