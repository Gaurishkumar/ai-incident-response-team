package com.devopscopilot.backend.scheduler;

import com.devopscopilot.backend.entity.Incident;
import com.devopscopilot.backend.repository.IncidentRepository;
import com.devopscopilot.backend.service.IncidentService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.OffsetDateTime;
import java.util.List;

@Component
@RequiredArgsConstructor
@Slf4j
public class PendingIncidentRetryScheduler {

    private final IncidentRepository incidentRepository;
    private final IncidentService incidentService;

    // Runs every 2 minutes. Republishes incidents stuck in PENDING for more than 3 minutes.
    @Scheduled(fixedDelay = 120_000)
    public void retryStuckPendingIncidents() {
        OffsetDateTime threshold = OffsetDateTime.now().minusMinutes(3);
        List<Incident> stuck = incidentRepository.findStuckPendingIncidents(threshold);

        if (!stuck.isEmpty()) {
            log.info("Retry scheduler: found {} stuck PENDING incident(s)", stuck.size());
            for (Incident incident : stuck) {
                log.info("Republishing analysis request for stuck incident {}", incident.getId());
                incidentService.publishAnalysisRequest(incident.getId());
            }
        }
    }
}
