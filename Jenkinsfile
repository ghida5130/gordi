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
                    
                    sh '''
                        set -e
                        set +x

                        docker network inspect app-network >/dev/null 2>&1 \
                        || docker network create app-network

                        docker compose up -d --build spring-backend
                    '''
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