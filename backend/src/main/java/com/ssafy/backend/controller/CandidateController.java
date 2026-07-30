package com.ssafy.backend.controller;

import com.ssafy.backend.common.response.ApiResponse;
import com.ssafy.backend.dto.candidate.CandidateAddRequestDTO;
import com.ssafy.backend.dto.candidate.CandidateListResponseDTO;
import com.ssafy.backend.dto.candidate.CandidateResponseDTO;
import com.ssafy.backend.service.CandidateService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/candidates")
@RequiredArgsConstructor
public class CandidateController {

    private final CandidateService candidateService;

    @PostMapping
    public ResponseEntity<ApiResponse<CandidateResponseDTO>> add(
            @RequestBody @Valid CandidateAddRequestDTO request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success(candidateService.add(request)));
    }

    @DeleteMapping("/{productId}")
    public ResponseEntity<Void> delete(@PathVariable Long productId,
                                       @RequestParam Long roomId) {
        candidateService.delete(roomId, productId);
        return ResponseEntity.noContent().build();  // 204
    }

    @GetMapping
    public ResponseEntity<ApiResponse<CandidateListResponseDTO>> list(
            @RequestParam Long roomId) {
        return ResponseEntity.ok(ApiResponse.success(candidateService.list(roomId)));
    }
}