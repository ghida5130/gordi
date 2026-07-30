package com.ssafy.backend.service;

import com.ssafy.backend.common.error.ApiException;
import com.ssafy.backend.common.error.ErrorCode;
import com.ssafy.backend.domain.Product;
import com.ssafy.backend.dto.product.ProductDetailResponseDTO;
import com.ssafy.backend.dto.product.ProductSearchResponseDTO;
import com.ssafy.backend.repository.ProductBottomSizeRepository;
import com.ssafy.backend.repository.ProductRepository;
import com.ssafy.backend.repository.ProductTopSizeRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ProductService {

    private final ProductRepository productRepository;
    private final ProductTopSizeRepository productTopSizeRepository;
    private final ProductBottomSizeRepository productBottomSizeRepository;

    public ProductDetailResponseDTO getDetail(Long productId) {
        Product product = productRepository.findById(productId)
                .orElseThrow(() -> new ApiException(ErrorCode.RESOURCE_NOT_FOUND));

        List<ProductDetailResponseDTO.TopSize> topSizes = null;
        List<ProductDetailResponseDTO.BottomSize> bottomSizes = null;

        if ("TOP".equals(product.getCategory())) {
            topSizes = productTopSizeRepository.findAllByProductId(productId).stream()
                    .map(s -> new ProductDetailResponseDTO.TopSize(
                            s.getId(), s.getSizeName(), s.getTotalLength(),
                            s.getShoulderWidth(), s.getChestWidth(), s.getSleeveLength()))
                    .toList();
        } else if ("BOTTOM".equals(product.getCategory())) {
            bottomSizes = productBottomSizeRepository.findAllByProductId(productId).stream()
                    .map(s -> new ProductDetailResponseDTO.BottomSize(
                            s.getId(), s.getSizeName(), s.getTotalLength(),
                            s.getWaistWidth(), s.getHipWidth(), s.getThighWidth(), s.getRise()))
                    .toList();
        }

        return new ProductDetailResponseDTO(
                product.getId(), product.getName(), product.getBrand(), product.getPrice(),
                product.getCategory(), product.getSubcategory(),
                product.getImageUrl(), product.getPurchaseUrl(), product.getDescription(),
                topSizes, bottomSizes);
    }

    public ProductSearchResponseDTO search(String category, Integer minPrice,
                                           Integer maxPrice, String keyword,
                                           int page, int size) {
        if (keyword != null && keyword.isBlank()) keyword = null;  // 빈 문자열 방어

        Page<Product> result = productRepository.search(
                category, minPrice, maxPrice, keyword, PageRequest.of(page, size));

        return new ProductSearchResponseDTO(
                result.getContent().stream()
                        .map(p -> new ProductSearchResponseDTO.Item(
                                p.getId(), p.getName(), p.getBrand(), p.getPrice(),
                                p.getCategory(), p.getSubcategory(),
                                p.getImageUrl(), p.getPurchaseUrl()))
                        .toList(),
                result.getNumber(), result.getSize(), result.getTotalElements());
    }
}