# 课间 · 西农课程共享计划

网站：https://runawayaway.github.io/kejian-course-library/

学生可以直接在网页新增课程、写经验、上传文件和修改自己的内容，无需登录或跳转 GitHub。保存成功后立即显示，其他访客刷新即可查看。

## 使用方式

- 添加课程：课程名必填，简介可选；同名课程会提示使用已有课程。
- 写经验：正文必填，教师和学期可选。授课方式、考核比例和学习建议均可写在这里。
- 上传资料：选择本地文件，说明可选，网站不额外限制单文件大小。实际上传仍受托管服务请求上限和剩余存储空间影响。支持 PDF、Office 文档、文本、ZIP、Notebook 及常见代码文件。
- 修改：在创建内容的同一浏览器点击“修改”，原内容自动填入；资料可以替换文件。
- 预览：点击资料标题或“预览”在站内阅读 PDF、文本和代码；Office 文档使用 Microsoft 在线预览，需能够访问其服务。保留下载入口；ZIP 等格式下载后查看。长文本预览显示前 1 MB，不影响完整文件下载。

匿名修改权限保存在当前浏览器。“我的投稿”支持修改、删除和备份恢复码；更换设备后输入恢复码可继续维护。请在清除浏览器数据前备份恢复码，不要公开分享。恢复码也丢失时需要管理员协助。管理员通过页脚“管理”输入私有管理密钥，再到“我的投稿”处理反馈、核实和维护内容。密钥保存在本机被 Git 忽略的 `.env.backend-admin`，不应提交或分享。详细流程见 [维护与交接说明](MAINTENANCE.md)。

## 数据与文件

前端继续由 GitHub Pages 公开托管。独立投稿服务使用 D1 保存课程与经验，R2 保存新上传文件。新增和修改无需等待 GitHub Pages 重新发布。

文件服务：https://kejian-contributions.milkycod4096.chatgpt.site

后端源代码位于 `sites-api/`，由 Sites 的独立源仓库管理，包含数据库迁移，不纳入前端仓库。管理密钥由服务端环境变量保存。

原有资料来自 [NWAFU-coursework-experimental-report](https://github.com/runawayaway/NWAFU-coursework-experimental-report)：23 个课程目录、120 组文档、488 个底层文件，保留原始来源链接。原作者说明和使用权限以源仓库为准；未经核实的教师、学分、考核信息不做推断。原操作系统修课经验已保留。

`data/courses.js` 是源仓库资料索引；`data/community.json` 是投稿元数据快照，服务暂时不可用时提供只读内容。快照不包含上传文件本身，不能作为文件备份。

## 本地运行与检查

前端 Node.js 18 以上，无需安装依赖：

```sh
npm start
npm run check
```

访问 http://localhost:4173，默认连接已发布的文件服务。后端开发需要 Node.js 22.13 以上及 Sites 本地环境，数据库迁移位于 `sites-api/drizzle/`。

```sh
npm run test:api
python scripts/browser-check.py
```

测试默认连接本地 API `http://127.0.0.1:8788`；用 `API_TEST_URL` 指定服务，浏览器测试用 `TEST_URL` 指定前端。测试实际创建、修改、上传、下载并清理测试记录，覆盖跨浏览器权限与刷新后持久化。截图保存在 `artifacts/`。

## 同步与发布

```sh
npm run sync:community
npm run sync
npm run deploy
```

`sync:community` 导出后端公开元数据快照；`sync` 另通过 GitHub CLI 更新原始资料索引，需要维护者的 GitHub 登录。学生投稿不需要这些步骤。

main 保存前端源代码，`deploy` 校验后将网页推送到 gh-pages；Pages 从 gh-pages 根目录发布。后端通过 Sites 的源代码打包、保存版本和部署流程独立发布，保留同一项目和数据库迁移。

也可运行 `docker compose up -d --build`，访问 http://localhost:8080。Docker 仅托管前端，投稿连接独立服务；可用 `WEB_PORT` 调整端口。
