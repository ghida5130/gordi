package com.ssafy.backend.controller;

import com.ssafy.backend.common.response.ApiResponse;
import com.ssafy.backend.dto.product.ProductDetailResponseDTO;
import com.ssafy.backend.dto.product.ProductSearchResponseDTO;
import com.ssafy.backend.service.ProductService;
import com.ssafy.backend.util.RoomPrincipalResolver;
import com.ssafy.backend.websocket.RoomPrincipal;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/products")
@RequiredArgsConstructor
@Validated
public class ProductController {

    private final ProductService productService;

    @GetMapping("/{clothesId}")
    public ResponseEntity<ApiResponse<ProductDetailResponseDTO>> detail(
            @PathVariable Long clothesId,
            Authentication authentication
    ) {
        RoomPrincipal principal = RoomPrincipalResolver.require(authentication);
        return ResponseEntity.ok(ApiResponse.success(productService.getDetail(clothesId, principal)));
    }

    @GetMapping
    public ResponseEntity<ApiResponse<ProductSearchResponseDTO>> search(
            @RequestParam(required = false) String category,
            @RequestParam(required = false) String subcategory,
            @RequestParam(required = false) Integer minPrice,
            @RequestParam(required = false) Integer maxPrice,
            @RequestParam(required = false) @Size(max=50) String keyword,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            Authentication authentication
    ) {
        RoomPrincipal principal = RoomPrincipalResolver.require(authentication);
        return ResponseEntity.ok(ApiResponse.success(
                productService.search(category, subcategory, minPrice, maxPrice, keyword, page, size, principal)));
    }
}
