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
                    echo '2. Docker 이미지 빌드 및 Docker Compose 배포'
                    
                    withCredentials([file(credentialsId: 'backend-env-file', variable: 'BACKEND_ENV_FILE')]) {
                        sh '''
                            set -e
                            set +x

                            echo "1. 환경변수 파일(.env) 주입"
                            test -f "$BACKEND_ENV_FILE"
                            cp "$BACKEND_ENV_FILE" .env

                            echo "2. backend 전용 Docker Compose 실행"
                            # --build 옵션을 통해 방금 새로 빌드된 jar를 기반으로 이미지를 새로 생성하고 재배포합니다.
                            # infra(DB, Redis 등)는 영향을 받지 않고 backend 컨테이너만 교체됩니다.
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