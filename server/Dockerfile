ARG NODE_IMAGE=node:22-alpine
FROM ${NODE_IMAGE}
WORKDIR /app/server
COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts --no-audit --no-fund
WORKDIR /app
COPY server/ ./server/
COPY data/courses.js ./data/courses.js
RUN mkdir -p /var/lib/kejian/files && chown -R node:node /var/lib/kejian
ENV NODE_ENV=production PORT=3000 UPLOAD_DIR=/var/lib/kejian/files
USER node
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=5s --start-period=20s CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node","server/index.mjs"]
