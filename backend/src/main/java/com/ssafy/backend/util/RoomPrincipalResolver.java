package com.ssafy.backend.util;

import com.ssafy.backend.common.error.ApiException;
import com.ssafy.backend.common.error.ErrorCode;
import com.ssafy.backend.websocket.RoomPrincipal;
import org.springframework.security.core.Authentication;

public final class RoomPrincipalResolver {

    private RoomPrincipalResolver() {
    }

    public static RoomPrincipal require(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()) {
            throw new ApiException(ErrorCode.UNAUTHORIZED);
        }

        if (!(authentication.getPrincipal() instanceof RoomPrincipal principal)) {
            throw new ApiException(ErrorCode.FORBIDDEN);
        }

        return principal;
    }
}
