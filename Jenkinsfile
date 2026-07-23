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
                    
                    withCredentials([file(credentialsId: 'backend-env-file', variable: 'BACKEND_ENV_FILE')]) {
                        sh '''
                            set -e
                            set +x

                            echo "환경변수 파일 존재 여부 확인"
                            test -f "$BACKEND_ENV_FILE"

                            echo "2. 기존 backend 서비스 안전하게 중지 및 삭제"
                            # 기존 컨테이너를 먼저 내립니다. (오류가 나도 계속 진행하도록 || true 추가)
                            docker-compose -f docker-compose.prod.yml down || true

                            echo "2. backend 전용 Docker Compose 실행"
                            docker compose -f docker-compose.prod.yml --env-file "$BACKEND_ENV_FILE" up -d --build
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