package com.ssafy.backend.controller;

import com.ssafy.backend.common.response.ApiResponse;
import com.ssafy.backend.dto.product.ProductDetailResponseDTO;
import com.ssafy.backend.dto.product.ProductSearchResponseDTO;
import com.ssafy.backend.service.ProductService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/products")
@RequiredArgsConstructor
public class ProductController {

    private final ProductService productService;

    @GetMapping("/{clothesId}")
    public ResponseEntity<ApiResponse<ProductDetailResponseDTO>> detail(
            @PathVariable Long clothesId) {
        return ResponseEntity.ok(ApiResponse.success(productService.getDetail(clothesId)));
    }

    @GetMapping
    public ResponseEntity<ApiResponse<ProductSearchResponseDTO>> search(
            @RequestParam(required = false) String category,
            @RequestParam(required = false) Integer minPrice,
            @RequestParam(required = false) Integer maxPrice,
            @RequestParam(required = false) String keyword,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(ApiResponse.success(
                productService.search(category, minPrice, maxPrice, keyword, page, size)));
    }
}