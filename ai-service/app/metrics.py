from prometheus_client import Counter, Histogram, Gauge

analysis_pipeline_duration = Histogram(
    "analysis_pipeline_duration_seconds",
    "Full pipeline execution time in seconds",
    labelnames=["analysis_status"],
    buckets=[5, 10, 30, 60, 90, 120, 180, 300],
)

agent_execution_duration = Histogram(
    "agent_execution_duration_seconds",
    "Per-agent execution time in seconds",
    labelnames=["agent_name"],
    buckets=[1, 5, 10, 20, 30, 45, 60],
)

agent_failures_total = Counter(
    "agent_failures_total",
    "Total number of agent failures",
    labelnames=["agent_name"],
)

active_analyses = Gauge(
    "active_analyses",
    "Number of currently running analysis pipelines",
)

llm_call_duration = Histogram(
    "llm_call_duration_seconds",
    "LLM inference time per call",
    labelnames=["agent_name"],
    buckets=[1, 5, 10, 20, 30, 45, 60],
)
