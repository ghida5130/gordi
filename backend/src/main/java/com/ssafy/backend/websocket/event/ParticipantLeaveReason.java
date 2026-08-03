package com.ssafy.backend.websocket.event;

/** 참가자가 활성 참여자 목록에서 제거된 원인. */
public enum ParticipantLeaveReason {
    USER_REQUEST,
    CONNECTION_LOST
}
