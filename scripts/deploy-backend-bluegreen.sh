#!/usr/bin/env bash
# 백엔드 블루-그린 무중단 배포
# 흐름: 비활성 색 빌드·기동 → 헬스체크 통과 시에만 Nginx 전환 → 드레인 → 이전 색 정지
set -euo pipefail

COMPOSE="docker compose -f docker-compose.prod.yml"
NGINX_CONTAINER="nginx"
INC_PATH="/etc/nginx/conf.d/backend-active.inc"   # nginx 컨테이너 내부 경로 (호스트 conf.d에 바인드됨)
HEALTH_TIMEOUT=90   # 초. Spring Boot 기동 + DB/Redis 연결 대기
DRAIN_SECONDS=30    # 전환 후 이전 색이 진행 중 요청을 마저 처리할 시간

# 1. 현재 활성 색 판별
current=$(docker exec "$NGINX_CONTAINER" cat "$INC_PATH")
if echo "$current" | grep -q 'gordi-backend-blue'; then
    active="blue";  target="green"
elif echo "$current" | grep -q 'gordi-backend-green'; then
    active="green"; target="blue"
else
    # 구 단일 컨테이너(gordi-backend)가 서비스 중인 최초 마이그레이션 상태
    active="legacy"; target="blue"
fi
echo "=== 활성: $active → 배포 대상: $target"

# 2. 대상 색 빌드·기동 (아직 트래픽 없음)
$COMPOSE up -d --build "backend-$target"

# 3. 헬스체크 폴링 — DB/Redis 연결까지 확인된 UP일 때만 전환
echo "=== 헬스체크 대기 (최대 ${HEALTH_TIMEOUT}초)"
healthy=false
for _ in $(seq 1 $((HEALTH_TIMEOUT / 2))); do
    if docker exec "gordi-backend-$target" \
        wget -qO- http://localhost:8080/actuator/health 2>/dev/null \
        | grep -q '"status":"UP"'; then
        healthy=true; break
    fi
    sleep 2
done

if [ "$healthy" != "true" ]; then
    echo "!!! 헬스체크 실패 — 기존 서비스는 그대로 두고 새 컨테이너만 정리"
    docker logs --tail 100 "gordi-backend-$target" || true
    $COMPOSE stop "backend-$target"
    exit 1
fi
echo "=== $target UP 확인"

# 4. Nginx 전환: .inc 덮어쓰기 → 문법 검사 → graceful reload
docker exec "$NGINX_CONTAINER" sh -c \
    "echo 'set \$backend gordi-backend-$target:8080;' > $INC_PATH"
if ! docker exec "$NGINX_CONTAINER" nginx -t; then
    echo "!!! nginx 설정 오류 — 원복 후 중단"
    docker exec "$NGINX_CONTAINER" sh -c "echo '$current' > $INC_PATH"
    $COMPOSE stop "backend-$target"
    exit 1
fi
docker exec "$NGINX_CONTAINER" nginx -s reload
echo "=== 트래픽이 $target 으로 전환됨"

# 5. 드레인: 이전 색이 처리 중이던 요청·WS 연결이 정리될 시간
sleep "$DRAIN_SECONDS"

# 6. 이전 색 정지 (rm 하지 않음 — .inc 원복 + docker start 로 즉시 롤백 가능)
if [ "$active" = "legacy" ]; then
    docker stop gordi-backend || true
    docker rm gordi-backend || true   # 구 단일 컨테이너는 compose 정의에서 빠졌으므로 제거
else
    $COMPOSE stop "backend-$active"
fi
echo "=== 배포 완료: $target 활성, $active 정지"