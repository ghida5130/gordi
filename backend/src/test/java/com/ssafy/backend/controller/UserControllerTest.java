package com.ssafy.backend.controller;

import com.ssafy.backend.dto.tryon.TryOnImageListResponseDTO;
import com.ssafy.backend.service.AvatarService;
import com.ssafy.backend.service.ResultService;
import com.ssafy.backend.service.RoomService;
import com.ssafy.backend.service.TryOnImageService;
import com.ssafy.backend.service.UserService;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.time.Instant;
import java.util.List;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class UserControllerTest {

    private final UserService userService = mock(UserService.class);
    private final AvatarService avatarService = mock(AvatarService.class);
    private final ResultService resultService = mock(ResultService.class);
    private final RoomService roomService = mock(RoomService.class);
    private final TryOnImageService tryOnImageService = mock(TryOnImageService.class);
    private final MockMvc mockMvc = MockMvcBuilders.standaloneSetup(new UserController(
            userService,
            avatarService,
            resultService,
            roomService,
            tryOnImageService
    )).build();

    @Test
    void readMyTryOnImagesUsesAuthenticatedMemberAndPagination() throws Exception {
        Instant createdAt = Instant.parse("2026-08-07T01:30:00Z");
        Instant completedAt = Instant.parse("2026-08-07T01:30:08Z");
        when(tryOnImageService.readMyImages("member@example.com", 2, 5))
                .thenReturn(new TryOnImageListResponseDTO(
                        List.of(new TryOnImageListResponseDTO.Item(
                                71L,
                                "https://cdn.example.com/71.webp",
                                1024,
                                1536,
                                createdAt,
                                completedAt
                        )),
                        2,
                        5,
                        12
                ));

        mockMvc.perform(get("/api/v1/users/me/try-on-images")
                        .param("page", "2")
                        .param("size", "5")
                        .principal(new UsernamePasswordAuthenticationToken(
                                "member@example.com",
                                null
                        )))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.images[0].jobId").value(71))
                .andExpect(jsonPath("$.data.images[0].imageUrl")
                        .value("https://cdn.example.com/71.webp"))
                .andExpect(jsonPath("$.data.page").value(2))
                .andExpect(jsonPath("$.data.size").value(5))
                .andExpect(jsonPath("$.data.totalElements").value(12));

        verify(tryOnImageService).readMyImages("member@example.com", 2, 5);
    }
}
