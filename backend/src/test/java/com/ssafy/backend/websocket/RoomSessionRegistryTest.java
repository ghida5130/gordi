package com.ssafy.backend.websocket;

import com.ssafy.backend.websocket.event.ParticipantLeaveReason;
import com.ssafy.backend.websocket.service.RoomLeaveService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.scheduling.TaskScheduler;

import java.time.Instant;
import java.util.concurrent.ScheduledFuture;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class RoomSessionRegistryTest {

    @Mock
    private TaskScheduler taskScheduler;
    @Mock
    private RoomLeaveService roomLeaveService;
    @Mock
    private ScheduledFuture<?> scheduledFuture;

    private RoomSessionRegistry roomSessionRegistry;

    @BeforeEach
    void setUp() {
        roomSessionRegistry = new RoomSessionRegistry(taskScheduler, roomLeaveService, 15_000L);
    }

    @Test
    void 현재_세션이_끊기고_유예시간이_끝나면_CONNECTION_LOST로_퇴장시킨다() {
        ArgumentCaptor<Runnable> taskCaptor = scheduleCaptor();
        roomSessionRegistry.connected(31L, 42L, "session-1");

        roomSessionRegistry.disconnected(31L, 42L, "session-1");
        taskCaptor.getValue().run();

        verify(roomLeaveService).leave(
                31L, 42L, null, ParticipantLeaveReason.CONNECTION_LOST);
    }

    @Test
    void 유예시간_안에_재접속하면_예약을_취소하고_퇴장시키지_않는다() {
        ArgumentCaptor<Runnable> taskCaptor = scheduleCaptor();
        roomSessionRegistry.connected(31L, 42L, "session-1");
        roomSessionRegistry.disconnected(31L, 42L, "session-1");

        roomSessionRegistry.connected(31L, 42L, "session-2");
        taskCaptor.getValue().run();

        verify(scheduledFuture).cancel(false);
        verify(roomLeaveService, never()).leave(any(), any(), any(), any());
    }

    @Test
    void 새_세션이_현재_세션이면_이전_세션의_disconnect를_무시한다() {
        roomSessionRegistry.connected(31L, 42L, "session-1");
        roomSessionRegistry.connected(31L, 42L, "session-2");

        roomSessionRegistry.disconnected(31L, 42L, "session-1");

        verify(taskScheduler, never()).schedule(any(Runnable.class), any(Instant.class));
    }

    @Test
    void 같은_disconnect가_중복_발생해도_유예작업은_하나만_예약한다() {
        scheduleCaptor();
        roomSessionRegistry.connected(31L, 42L, "session-1");

        roomSessionRegistry.disconnected(31L, 42L, "session-1");
        roomSessionRegistry.disconnected(31L, 42L, "session-1");

        verify(taskScheduler, times(1)).schedule(any(Runnable.class), any(Instant.class));
    }

    private ArgumentCaptor<Runnable> scheduleCaptor() {
        ArgumentCaptor<Runnable> captor = ArgumentCaptor.forClass(Runnable.class);
        doReturn(scheduledFuture)
                .when(taskScheduler)
                .schedule(captor.capture(), any(Instant.class));
        return captor;
    }
}
