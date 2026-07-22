pipeline {
    agent any

    stages {
        stage('Backend Build') {
            steps {
                dir('backend') {
                    echo '1. Spring Boot Gradle 빌드 시작 (Java 21)'
                    sh 'chmod +x ./gradlew'
                    // 테스트 제외하고 빌드 (.jar 생성)
                    sh './gradlew clean build -x test'
                }
            }
        }

        stage('Backend Docker Deploy') {
            steps {
                dir('backend') {
                    echo '2. Docker 이미지 빌드 및 컨테이너 실행'
                    
                    // 기존 실행 중인 백엔드 컨테이너가 있다면 중지 및 삭제 (오류 무시 || true)
                    sh 'docker stop spring-backend || true'
                    sh 'docker rm spring-backend || true'
                    
                    // Docker 이미지 빌드
                    sh 'docker build -t spring-backend:latest .'
                    
                    // 동일한 app-network 상에서 컨테이너 실행
                    sh '''
                        docker run -d \
                          --name spring-backend \
                          --network app-network \
                          -p 8080:8080 \
                          spring-backend:latest
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