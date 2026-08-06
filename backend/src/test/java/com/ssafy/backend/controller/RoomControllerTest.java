package com.ssafy.backend.controller;

import com.ssafy.backend.common.response.ApiResponse;
import com.ssafy.backend.dto.results.RoomResultResponseDTO;
import com.ssafy.backend.dto.room.RoomFinishRequestDTO;
import com.ssafy.backend.dto.room.RoomFinishResponseDTO;
import com.ssafy.backend.dto.room.RoomStatusResponseDTO;
import com.ssafy.backend.service.RoomFinishService;
import com.ssafy.backend.service.ResultService;
import com.ssafy.backend.service.RoomService;
import com.ssafy.backend.websocket.RoomPrincipal;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RoomControllerTest {

    @Mock
    private RoomService roomService;
    @Mock
    private RoomFinishService roomFinishService;
    @Mock
    private ResultService resultService;

    @InjectMocks
    private RoomController roomController;

    @Test
    void readStatusReturnsWrappedResponse() {
        Authentication authentication = new UsernamePasswordAuthenticationToken(
                "member@example.com",
                null,
                List.of()
        );
        RoomStatusResponseDTO serviceResponse = new RoomStatusResponseDTO(
                31L,
                "A7K9Q2",
                "IN_PROGRESS",
                12L,
                Instant.parse("2026-07-23T03:00:00Z"),
                "TOP",
                "SHIRT",
                "https://cdn.example.com/images/avatars/host.png",
                List.of(new RoomStatusResponseDTO.Participant(
                        42L,
                        "홍길동",
                        "HOST"
                )),
                List.of(new RoomStatusResponseDTO.Tier(1L, "S", 0))
        );
        when(roomService.readStatusByAccessToken("A7K9Q2", "member@example.com"))
                .thenReturn(serviceResponse);

        ResponseEntity<ApiResponse<RoomStatusResponseDTO>> response =
                roomController.readStatus("A7K9Q2", authentication);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().data()).isEqualTo(serviceResponse);
        verify(roomService).readStatusByAccessToken("A7K9Q2", "member@example.com");
    }

    @Test
    void readStatusDelegatesRoomPrincipalWithoutAuthenticationDependencyInService() {
        RoomPrincipal principal = new RoomPrincipal(42L, 31L, "host", "HOST");
        Authentication authentication = new UsernamePasswordAuthenticationToken(
                principal,
                null,
                List.of()
        );
        RoomStatusResponseDTO serviceResponse = new RoomStatusResponseDTO(
                31L,
                "A7K9Q2",
                "WAITING",
                0L,
                Instant.parse("2026-07-23T03:00:00Z"),
                "TOP",
                "SHIRT",
                null,
                List.of(),
                List.of()
        );
        when(roomService.readStatus("A7K9Q2", principal)).thenReturn(serviceResponse);

        ResponseEntity<ApiResponse<RoomStatusResponseDTO>> response =
                roomController.readStatus("A7K9Q2", authentication);

        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().data()).isEqualTo(serviceResponse);
        verify(roomService).readStatus("A7K9Q2", principal);
    }

    @Test
    void finishDelegatesRoomTokenPrincipal() {
        RoomPrincipal principal = new RoomPrincipal(42L, 31L, "host", "HOST");
        Authentication authentication = new UsernamePasswordAuthenticationToken(
                principal,
                null,
                List.of()
        );
        RoomFinishRequestDTO request = new RoomFinishRequestDTO(17L);
        RoomFinishResponseDTO serviceResponse = new RoomFinishResponseDTO(
                51L,
                31L,
                "FINISHED",
                List.of(),
                "https://cdn.example.com/fitting.webp",
                Instant.parse("2026-07-23T02:00:00Z")
        );
        when(roomFinishService.finish("A7K9Q2", request, principal))
                .thenReturn(serviceResponse);

        ResponseEntity<ApiResponse<RoomFinishResponseDTO>> response =
                roomController.finish("A7K9Q2", request, authentication);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().data()).isEqualTo(serviceResponse);
        verify(roomFinishService).finish("A7K9Q2", request, principal);
    }

    @Test
    void readResultDelegatesRoomTokenPrincipal() {
        RoomPrincipal principal = new RoomPrincipal(42L, 31L, "guest", "PARTICIPANTS");
        Authentication authentication = new UsernamePasswordAuthenticationToken(
                principal,
                null,
                List.of()
        );
        RoomResultResponseDTO serviceResponse = roomResultResponse();
        when(resultService.readRoomResult("A7K9Q2", principal)).thenReturn(serviceResponse);

        ResponseEntity<ApiResponse<RoomResultResponseDTO>> response =
                roomController.readResult("A7K9Q2", authentication);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().data()).isEqualTo(serviceResponse);
        verify(resultService).readRoomResult("A7K9Q2", principal);
    }

    @Test
    void readResultDelegatesAccessTokenEmail() {
        Authentication authentication = new UsernamePasswordAuthenticationToken(
                "member@example.com",
                null,
                List.of()
        );
        RoomResultResponseDTO serviceResponse = roomResultResponse();
        when(resultService.readRoomResultByAccessToken(
                "A7K9Q2",
                "member@example.com"
        )).thenReturn(serviceResponse);

        ResponseEntity<ApiResponse<RoomResultResponseDTO>> response =
                roomController.readResult("A7K9Q2", authentication);

        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().data()).isEqualTo(serviceResponse);
        verify(resultService).readRoomResultByAccessToken(
                "A7K9Q2",
                "member@example.com"
        );
    }

    private RoomResultResponseDTO roomResultResponse() {
        return new RoomResultResponseDTO(
                51L,
                "A7K9Q2",
                17L,
                List.of(new RoomResultResponseDTO.TopItem(
                        1,
                        301L,
                        101L,
                        "오버핏 시어커튼 셔츠",
                        "MUSINSA STANDARD",
                        39_900,
                        "https://cdn.example.com/products/501.jpg",
                        1,
                        new RoomResultResponseDTO.TierInfo(1L, "S")
                )),
                "https://cdn.example.com/fittings/71.webp",
                List.of(),
                "생성 이미지는 실제 핏과 다를 수 있습니다.",
                Instant.parse("2026-07-23T02:00:00Z")
        );
    }
}
