package com.ssafy.backend.config;

import com.ssafy.backend.config.enums.CategoryCode;
import com.ssafy.backend.config.enums.GenderCode;
import com.ssafy.backend.config.enums.RecommendationStatus;
import com.ssafy.backend.config.enums.SubcategoryCode;
import com.ssafy.backend.domain.Recommendation;
import com.ssafy.backend.domain.User;
import com.ssafy.backend.dto.users.UserRequestDTO;
import com.ssafy.backend.repository.RecommendationRepository;
import com.ssafy.backend.repository.UserRepository;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validator;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Slf4j
@Component
@RequiredArgsConstructor
public class DataInitializer implements CommandLineRunner {

    private final UserRepository userRepository;
    private final RecommendationRepository recommendationRepository;
    private final PasswordEncoder passwordEncoder;
    private final Validator validator;

    @Override
    @Transactional
    public void run(String... args) {
        if (userRepository.count() > 0) {
            log.info("[DataInitializer] Users already exist. Skipping initialization.");
            return;
        }

        List<User> users = createUsers();
        createRecommendations(users);

        log.info("[DataInitializer] Created {} users and {} recommendations.",
                users.size(), recommendationRepository.count());
    }

    private List<User> createUsers() {
        List<User> users = new ArrayList<>();

        for (int i = 1; i <= 10; i++) {
            UserRequestDTO dto = new UserRequestDTO(
                    "user%02d@test.com".formatted(i),
                    "Test%04d!".formatted(i * 111),
                    "테스트유저%02d".formatted(i)
            );

            validate(dto);

            User user = User.builder()
                    .email(dto.getEmail())
                    .password(passwordEncoder.encode(dto.getPassword()))
                    .nickname(dto.getNickname())
                    .build();
            users.add(user);
        }

        return userRepository.saveAll(users);
    }

    private void validate(UserRequestDTO dto) {
        Set<ConstraintViolation<UserRequestDTO>> violations =
                validator.validate(dto, UserRequestDTO.addGroup.class);
        if (!violations.isEmpty()) {
            String message = violations.stream()
                    .map(v -> v.getPropertyPath() + ": " + v.getMessage())
                    .collect(Collectors.joining(", "));
            throw new IllegalStateException("[DataInitializer] Invalid seed user (" + dto.getEmail() + "): " + message);
        }
    }

    private void createRecommendations(List<User> users) {
        record Seed(GenderCode gender, CategoryCode category, SubcategoryCode subcategory, int budgetMin, int budgetMax) {}

        List<Seed> seeds = List.of(
                new Seed(GenderCode.MALE, CategoryCode.TOP, SubcategoryCode.SHIRT, 30_000, 120_000),
                new Seed(GenderCode.FEMALE, CategoryCode.TOP, SubcategoryCode.SHORT_SLEEVE, 15_000, 50_000),
                new Seed(GenderCode.MALE, CategoryCode.TOP, SubcategoryCode.KNIT, 40_000, 150_000),
                new Seed(GenderCode.FEMALE, CategoryCode.TOP, SubcategoryCode.HOODIE, 30_000, 90_000),
                new Seed(GenderCode.MALE, CategoryCode.BOTTOM, SubcategoryCode.DENIM_PANTS, 40_000, 130_000),
                new Seed(GenderCode.FEMALE, CategoryCode.BOTTOM, SubcategoryCode.SLACKS, 30_000, 100_000),
                new Seed(GenderCode.MALE, CategoryCode.OUTER, SubcategoryCode.JACKET, 80_000, 250_000),
                new Seed(GenderCode.FEMALE, CategoryCode.OUTER, SubcategoryCode.CARDIGAN, 40_000, 140_000),
                new Seed(GenderCode.UNISEX, CategoryCode.SHOES, SubcategoryCode.SNEAKERS, 60_000, 200_000),
                new Seed(GenderCode.UNISEX, CategoryCode.SHOES, SubcategoryCode.LOAFER, 70_000, 220_000)
        );

        List<Recommendation> recommendations = new ArrayList<>();
        for (int i = 0; i < seeds.size(); i++) {
            Seed seed = seeds.get(i);
            recommendations.add(Recommendation.builder()
                    .user(users.get(i % users.size()))
                    .gender(seed.gender().name())
                    .category(seed.category().name())
                    .subcategory(seed.subcategory().name())
                    .budgetMin(seed.budgetMin())
                    .budgetMax(seed.budgetMax())
                    .status(RecommendationStatus.READY.name())
                    .version(1L)
                    .build());
        }

        recommendationRepository.saveAll(recommendations);
    }
}
