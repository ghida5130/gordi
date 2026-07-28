# 설치 & 빌드
FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# 파일 복사
COPY . .

# ARG VITE_API_BASE_URL
# ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}

RUN npm run build

# nginx를 통한 정적 파일 실행
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]