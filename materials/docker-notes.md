# Docker 入门：从镜像到 Compose

> 本站原创入门示例，允许公开分享。适用：虚拟化与容器技术示例课程。命令在安装好 Docker 的终端中执行，具体行为请结合本机版本和官方文档核对。

## 1. 先区分三个概念

- 镜像：应用和运行依赖的打包结果。
- 容器：镜像运行后的实例。
- 数据卷：独立于容器生命周期保留数据的存储方式。

## 2. 运行一个网页服务

```sh
docker run --name hello-nginx -d -p 8081:80 nginx:stable-alpine
docker ps
docker logs hello-nginx
```

访问 http://localhost:8081 。这里把主机的 8081 端口映射到容器的 80 端口。

实验结束后删除这一个测试容器：

```sh
docker rm -f hello-nginx
```

## 3. 本项目的 Compose 实验

```sh
docker compose up -d --build
docker compose ps
docker compose logs web
```

访问 http://localhost:8080 。本项目将宿主机的 data 和 materials 目录以只读方式挂载，重建容器不会删除宿主机中的课程与资料。

## 4. 排查顺序

1. 容器是否正常运行？先看 `docker compose ps`。
2. 服务启动失败？看 `docker compose logs web`。
3. 浏览器无法访问？核对主机端口和端口占用。
4. 修改后没有变化？检查挂载路径并强制刷新浏览器。

## 5. 答辩记录

画出浏览器 → 主机 8080 → 容器 80 → Nginx → 静态文件的请求路径。分别解释镜像构建、端口映射和目录挂载的作用。

原始参考：https://docs.docker.com/get-started/
