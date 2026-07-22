pipeline {
    agent any

    stages {
        stage('Backend Build') {
            steps {
                dir('backend') {
                    echo '1. Spring Boot Gradle 빌드 시작 (Java 21)'
                    sh 'chmod +x ./gradlew'
                    sh './gradlew clean build -x test'
                }
            }
        }

        stage('Backend Docker Deploy') {
            steps {
                dir('backend') {
                    echo '2. Docker 이미지 빌드 및 컨테이너 실행'
                    
                    // Jenkins Credentials에서 Secret file을 불러와 BACKEND_ENV_FILE 변수로 전달
                    withCredentials([file(credentialsId: 'backend-env-file', variable: 'BACKEND_ENV_FILE')]) {
                        sh '''
                            set -e
                            set +x

                            echo "환경변수 파일 존재 여부 확인"
                            test -f "$BACKEND_ENV_FILE"

                            docker stop spring-backend || true
                            docker rm spring-backend || true

                            docker build -t spring-backend:latest .

                            docker network inspect app-network >/dev/null 2>&1 \
                            || docker network create app-network

                            docker run -d \
                            --name spring-backend \
                            --network app-network \
                            --env-file "$BACKEND_ENV_FILE" \
                            -p 8080:8080 \
                            spring-backend:latest
                        '''
                    }
                }
            }
        }
    }

    post {
        success {
            echo '🎉 Spring Boot 컨테이너 배포 성공!'
        }
        failure {
            echo '🚨 백엔드 배포 실패! 젠킨스 콘솔 로그를 확인하세요.'
        }
    }
}