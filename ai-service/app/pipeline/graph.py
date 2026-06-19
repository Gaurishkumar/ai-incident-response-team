from langgraph.graph import END, StateGraph

from app.agents.log_analysis_agent import log_analysis_node
from app.agents.recommendation_agent import recommendation_node
from app.agents.root_cause_agent import root_cause_node
from app.models.state import IncidentAnalysisState


def create_pipeline():
    graph = StateGraph(IncidentAnalysisState)

    graph.add_node("log_analysis_agent", log_analysis_node)
    graph.add_node("root_cause_agent", root_cause_node)
    graph.add_node("recommendation_agent", recommendation_node)

    # Strictly linear: Log Analysis → Root Cause → Recommendation
    graph.set_entry_point("log_analysis_agent")
    graph.add_edge("log_analysis_agent", "root_cause_agent")
    graph.add_edge("root_cause_agent", "recommendation_agent")
    graph.add_edge("recommendation_agent", END)

    return graph.compile()


# Single compiled pipeline instance — reused across all requests
pipeline = create_pipeline()
