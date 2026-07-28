<<<<<<< HEAD
# 1. Java 21 JDK 이미지를 베이스로 사용
FROM eclipse-temurin:21-jdk-alpine AS builder

# 2. 작업 디렉토리 설정
WORKDIR /app

# Gradle 관련 파일 및 소스코드 복사
COPY gradlew .
COPY gradle gradle
COPY build.gradle settings.gradle .
COPY src src

# 실행 권한 부여 및 JAR 파일 빌드 (테스트 제외)
RUN chmod +x ./gradlew
RUN ./gradlew clean bootJar -x test --no-daemon

# 2. Run Stage
FROM eclipse-temurin:21-jdk-alpine
WORKDIR /app

COPY --from=builder /app/build/libs/*.jar app.jar

EXPOSE 8080

# 5. 컨테이너 실행 시 java -jar 실행
ENTRYPOINT ["java", "-jar", "app.jar"]
=======
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
>>>>>>> be/feat/room-domain
