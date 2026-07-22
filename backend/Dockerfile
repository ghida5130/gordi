# 1. Java 21 JDK 이미지를 베이스로 사용
FROM eclipse-temurin:21-jdk-alpine

# 2. 작업 디렉토리 설정
WORKDIR /app

# 3. Gradle 빌드로 생성된 jar 파일을 컨테이너 내부로 복사
ARG JAR_FILE=build/libs/*.jar
COPY ${JAR_FILE} app.jar

EXPOSE 8080

# 5. 컨테이너 실행 시 java -jar 실행
ENTRYPOINT ["java", "-jar", "app.jar"]