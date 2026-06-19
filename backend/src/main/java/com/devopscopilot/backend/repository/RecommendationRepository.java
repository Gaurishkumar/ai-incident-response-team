package com.devopscopilot.backend.repository;

import com.devopscopilot.backend.entity.Recommendation;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface RecommendationRepository extends JpaRepository<Recommendation, UUID> {
    List<Recommendation> findByIncidentIdOrderByRecommendationOrderAsc(UUID incidentId);
}
