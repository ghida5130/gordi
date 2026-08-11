pipeline {
    agent any

    parameters {
        booleanParam(name: 'FORCE_BACK',  defaultValue: false, description: '변경 없어도 Backend 강제 배포')
        booleanParam(name: 'FORCE_FRONT', defaultValue: false, description: '변경 없어도 Frontend 강제 배포')
        booleanParam(name: 'FORCE_AI',    defaultValue: false, description: '변경 없어도 AI 강제 배포')
    }

    environment {
        COMPOSE = 'docker compose -f docker-compose.prod.yml'
    }

    stages {
        stage('변경 감지') {
            steps {
                script {
                    def base = env.GIT_PREVIOUS_SUCCESSFUL_COMMIT ?: 'HEAD~1'
                    def valid = sh(script: "git cat-file -e '${base}^{commit}' 2>/dev/null", returnStatus: true) == 0

                    def changed = valid
                        ? sh(script: "git diff --name-only ${base} HEAD", returnStdout: true).trim().split('\n')
                        : []
                    
                    if (!valid) {
                        echo "기준 커밋(${base})을 찾을 수 없어 전체 배포합니다."
                    }

                    echo "변경 파일:\n${changed.join('\n')}"

                    env.BUILD_FRONT = (!valid || params.FORCE_FRONT || changed.any { it.startsWith('frontend/') }) ? 'true' : 'false'
                    env.BUILD_BACK  = (!valid || params.FORCE_BACK  || changed.any { it.startsWith('backend/') })  ? 'true' : 'false'
                    env.BUILD_AI    = (!valid || params.FORCE_AI || changed.any { it.startsWith('ai/') })       ? 'true' : 'false'

                    // 공통 파일 변경 시 전체 재배포
                    if (changed.any { it in ['docker-compose.prod.yml', 'Jenkinsfile'] }) {
                        env.BUILD_FRONT = 'true'
                        env.BUILD_BACK  = 'true'
                        env.BUILD_AI    = 'true'
                    }
                }
            }
        }

        stage('Backend 테스트') {
            when { expression { env.BUILD_BACK == 'true' } }
            steps {
                sh '''
                    docker run --rm  \
                    -e TZ=Asia/Seoul \
                    -v jenkins_home:/ws -w /ws/workspace/gordi-backend/backend \
                    -v gradle-cache:/root/.gradle \
                    eclipse-temurin:21-jdk-alpine \
                    sh -c "./gradlew test --no-daemon"
                '''
            }
        }

        stage('환경변수 준비') {
            steps {
                withCredentials([
                    file(credentialsId: 'backend-env-file',  variable: 'BACKEND_ENV_FILE'),
                    file(credentialsId: 'ai-env-file',  variable: 'AI_ENV_FILE'),
                    file(credentialsId: 'frontend-env-file', variable: 'FRONTEND_ENV_FILE')
                ]) {
                    sh '''
                        set -e
                        set +x
                        rm -f .env && cp "$BACKEND_ENV_FILE" .env
                        rm -f ./frontend/.env && cp "$FRONTEND_ENV_FILE" ./frontend/.env
                        rm -f ./ai/.env && cp "$AI_ENV_FILE" ./ai/.env
                    '''
                }
            }
        }

        stage('Backend 배포') {
            when { expression { env.BUILD_BACK == 'true' } }
            steps {
                sh '''
                    $COMPOSE up -d --build backend
                '''
            }
        }

        stage('Livekit 배포') {
            when { expression { env.BUILD_BACK == 'true' } }
            steps {
                sh '''
                    export DOCKER_BUILDKIT=0
                    export COMPOSE_DOCKER_CLI_BUILD=0
                    $COMPOSE up -d --build livekit
                '''
            }
        }

        stage('Frontend 배포') {
            when { expression { env.BUILD_FRONT == 'true' } }
            steps {
                sh '''
                    export DOCKER_BUILDKIT=0
                    export COMPOSE_DOCKER_CLI_BUILD=0
                    $COMPOSE up -d --build frontend
                '''
            }
        }

        stage('AI 배포') {
            when { expression { env.BUILD_AI == 'true' } }
            steps {
                sh '''
                    export DOCKER_BUILDKIT=0
                    export COMPOSE_DOCKER_CLI_BUILD=0
                    $COMPOSE up -d --build ai
                '''
            }
        }
    }

    post {
        success { echo "배포 완료 (back=${env.BUILD_BACK} front=${env.BUILD_FRONT} ai=${env.BUILD_AI})" }
        failure { echo '🚨 배포 실패' }
    }
}