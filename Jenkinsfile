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
                dir('.') {
                    echo '2. Docker 이미지 빌드 및 Docker Compose 배포'
                    
                    withCredentials([
                        file(credentialsId: 'backend-env-file', variable: 'BACKEND_ENV_FILE'),
                        file(credentialsId: 'frontend-env-file', variable: 'FRONTEND_ENV_FILE')
                    ]) {
                        sh '''
                            set -e
                            set +x

                            export DOCKER_BUILDKIT=0
                            export COMPOSE_DOCKER_CLI_BUILD=0

                            echo "2. 기존 backend 서비스 안전하게 중지 및 삭제"
                            # 기존 컨테이너를 먼저 내립니다. (오류가 나도 계속 진행하도록 || true 추가)
                            docker-compose -f docker-compose.prod.yml down || true

                            # 💡 $BACKEND_ENV_FILE을 빌드 위치의 .env 파일로 복사
                            rm -f .env
                            cp "$BACKEND_ENV_FILE" .env

                            rm -f ./frontend/.env
                            cp "$FRONTEND_ENV_FILE" ./frontend/.env

                            echo "2. backend 전용 Docker Compose 실행"
                            docker-compose -f docker-compose.prod.yml up -d --build
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