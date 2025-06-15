"""
Comprehensive Data Lineage Implementation System
Automated lineage tracking, impact analysis, and data quality monitoring
"""

import json
import logging
import asyncio
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Set, Tuple
from dataclasses import dataclass, asdict
from enum import Enum
import networkx as nx
import pandas as pd
from collections import defaultdict

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class NodeType(Enum):
    DATASET = "dataset"
    MODEL = "model"
    TRANSFORMATION = "transformation"
    SYSTEM = "system"
    FEATURE = "feature"
    PIPELINE = "pipeline"

class TransformationType(Enum):
    FILTER = "filter"
    AGGREGATE = "aggregate"
    JOIN = "join"
    CLEAN = "clean"
    ENRICH = "enrich"
    VALIDATE = "validate"
    FEATURE_ENGINEERING = "feature_engineering"
    MODEL_TRAINING = "model_training"

class QualityDimension(Enum):
    ACCURACY = "accuracy"
    COMPLETENESS = "completeness"
    CONSISTENCY = "consistency"
    TIMELINESS = "timeliness"
    VALIDITY = "validity"
    UNIQUENESS = "uniqueness"

@dataclass
class LineageNode:
    node_id: str
    node_type: NodeType
    name: str
    description: str
    metadata: Dict[str, Any]
    created_at: str
    updated_at: str
    owner: str
    tags: List[str]
    properties: Dict[str, Any]

@dataclass
class LineageEdge:
    source_id: str
    target_id: str
    relationship_type: str
    transformation_type: Optional[TransformationType]
    transformation_details: Dict[str, Any]
    created_at: str
    metadata: Dict[str, Any]

@dataclass
class DataQualityMetric:
    metric_id: str
    node_id: str
    dimension: QualityDimension
    value: float
    threshold: float
    status: str  # passed, failed, warning
    measured_at: str
    details: Dict[str, Any]

@dataclass
class ImpactAnalysis:
    analysis_id: str
    source_node_id: str
    affected_nodes: List[str]
    impact_score: float
    impact_type: str
    analysis_timestamp: str
    recommendations: List[str]

class DataLineageSystem:
    def __init__(self):
        self.lineage_graph = nx.DiGraph()
        self.nodes: Dict[str, LineageNode] = {}
        self.edges: Dict[str, LineageEdge] = {}
        self.quality_metrics: Dict[str, List[DataQualityMetric]] = defaultdict(list)
        self.impact_analyses: Dict[str, ImpactAnalysis] = {}
        
        # Initialize system
        self._initialize_sample_lineage()
    
    def _initialize_sample_lineage(self):
        """Initialize sample data lineage for AeroFusionXR"""
        # Data Sources
        self.register_node(LineageNode(
            node_id="src_flight_data",
            node_type=NodeType.DATASET,
            name="Flight Operations Data",
            description="Real-time flight operations data from airline systems",
            metadata={
                "source_system": "flight_management_system",
                "update_frequency": "real-time",
                "data_format": "json",
                "schema_version": "v2.1"
            },
            created_at=datetime.now().isoformat(),
            updated_at=datetime.now().isoformat(),
            owner="data-engineering-team",
            tags=["flight", "operations", "real-time"],
            properties={
                "row_count": 1500000,
                "column_count": 45,
                "size_gb": 12.5
            }
        ))
        
        self.register_node(LineageNode(
            node_id="src_passenger_data",
            node_type=NodeType.DATASET,
            name="Passenger Information",
            description="Passenger profiles and interaction data",
            metadata={
                "source_system": "passenger_management_system",
                "update_frequency": "hourly",
                "data_format": "parquet",
                "schema_version": "v1.8"
            },
            created_at=datetime.now().isoformat(),
            updated_at=datetime.now().isoformat(),
            owner="data-engineering-team",
            tags=["passenger", "pii", "interactions"],
            properties={
                "row_count": 850000,
                "column_count": 32,
                "size_gb": 8.2
            }
        ))
        
        # Transformations
        self.register_node(LineageNode(
            node_id="transform_flight_clean",
            node_type=NodeType.TRANSFORMATION,
            name="Flight Data Cleaning",
            description="Clean and validate flight operations data",
            metadata={
                "transformation_type": "data_cleaning",
                "code_repository": "https://github.com/aerofusionxr/data-pipelines",
                "code_version": "v2.3.1"
            },
            created_at=datetime.now().isoformat(),
            updated_at=datetime.now().isoformat(),
            owner="data-engineering-team",
            tags=["cleaning", "validation"],
            properties={
                "processing_time_minutes": 15,
                "success_rate": 0.998
            }
        ))
        
        # Processed Datasets
        self.register_node(LineageNode(
            node_id="dataset_flight_clean",
            node_type=NodeType.DATASET,
            name="Cleaned Flight Data",
            description="Cleaned and validated flight operations data",
            metadata={
                "processing_stage": "cleaned",
                "quality_score": 0.95,
                "last_processed": datetime.now().isoformat()
            },
            created_at=datetime.now().isoformat(),
            updated_at=datetime.now().isoformat(),
            owner="data-engineering-team",
            tags=["flight", "cleaned", "validated"],
            properties={
                "row_count": 1485000,
                "column_count": 42,
                "size_gb": 11.8
            }
        ))
        
        # AI Models
        self.register_node(LineageNode(
            node_id="model_ai_concierge",
            node_type=NodeType.MODEL,
            name="AI Concierge Model",
            description="AI-powered customer service assistant",
            metadata={
                "model_type": "transformer",
                "framework": "pytorch",
                "version": "v2.1.0",
                "training_date": datetime.now().isoformat()
            },
            created_at=datetime.now().isoformat(),
            updated_at=datetime.now().isoformat(),
            owner="ai-team",
            tags=["nlp", "customer-service", "production"],
            properties={
                "accuracy": 0.94,
                "f1_score": 0.92,
                "model_size_mb": 1250
            }
        ))
        
        # Features
        self.register_node(LineageNode(
            node_id="feature_passenger_profile",
            node_type=NodeType.FEATURE,
            name="Passenger Profile Features",
            description="Engineered features from passenger data",
            metadata={
                "feature_count": 25,
                "feature_engineering_version": "v1.5"
            },
            created_at=datetime.now().isoformat(),
            updated_at=datetime.now().isoformat(),
            owner="ml-engineering-team",
            tags=["features", "passenger", "engineered"],
            properties={
                "importance_score": 0.87,
                "correlation_threshold": 0.8
            }
        ))
        
        # Create relationships
        self.register_edge(LineageEdge(
            source_id="src_flight_data",
            target_id="transform_flight_clean",
            relationship_type="input",
            transformation_type=TransformationType.CLEAN,
            transformation_details={
                "operations": ["null_removal", "outlier_detection", "format_standardization"],
                "quality_rules": ["completeness > 0.95", "validity > 0.98"]
            },
            created_at=datetime.now().isoformat(),
            metadata={"processing_order": 1}
        ))
        
        self.register_edge(LineageEdge(
            source_id="transform_flight_clean",
            target_id="dataset_flight_clean",
            relationship_type="output",
            transformation_type=TransformationType.CLEAN,
            transformation_details={
                "output_format": "parquet",
                "partitioning": "date",
                "compression": "snappy"
            },
            created_at=datetime.now().isoformat(),
            metadata={"processing_order": 2}
        ))
        
        self.register_edge(LineageEdge(
            source_id="src_passenger_data",
            target_id="feature_passenger_profile",
            relationship_type="feature_source",
            transformation_type=TransformationType.FEATURE_ENGINEERING,
            transformation_details={
                "feature_operations": ["aggregation", "encoding", "normalization"],
                "feature_selection": "recursive_feature_elimination"
            },
            created_at=datetime.now().isoformat(),
            metadata={"feature_importance": 0.87}
        ))
        
        self.register_edge(LineageEdge(
            source_id="feature_passenger_profile",
            target_id="model_ai_concierge",
            relationship_type="training_input",
            transformation_type=TransformationType.MODEL_TRAINING,
            transformation_details={
                "training_algorithm": "transformer",
                "hyperparameters": {"learning_rate": 0.001, "batch_size": 32},
                "training_duration_hours": 12
            },
            created_at=datetime.now().isoformat(),
            metadata={"model_version": "v2.1.0"}
        ))
        
        # Initialize quality metrics
        self._initialize_quality_metrics()
    
    def _initialize_quality_metrics(self):
        """Initialize sample quality metrics"""
        nodes_to_monitor = ["src_flight_data", "dataset_flight_clean", "feature_passenger_profile"]
        
        for node_id in nodes_to_monitor:
            for dimension in QualityDimension:
                metric = DataQualityMetric(
                    metric_id=f"qm_{node_id}_{dimension.value}_{datetime.now().strftime('%Y%m%d')}",
                    node_id=node_id,
                    dimension=dimension,
                    value=self._generate_quality_score(dimension),
                    threshold=self._get_quality_threshold(dimension),
                    status="passed",
                    measured_at=datetime.now().isoformat(),
                    details={
                        "measurement_method": "automated",
                        "sample_size": 10000,
                        "confidence_level": 0.95
                    }
                )
                metric.status = "passed" if metric.value >= metric.threshold else "failed"
                self.quality_metrics[node_id].append(metric)
    
    def _generate_quality_score(self, dimension: QualityDimension) -> float:
        """Generate realistic quality scores"""
        base_scores = {
            QualityDimension.ACCURACY: 0.94,
            QualityDimension.COMPLETENESS: 0.96,
            QualityDimension.CONSISTENCY: 0.92,
            QualityDimension.TIMELINESS: 0.98,
            QualityDimension.VALIDITY: 0.95,
            QualityDimension.UNIQUENESS: 0.99
        }
        return base_scores.get(dimension, 0.90)
    
    def _get_quality_threshold(self, dimension: QualityDimension) -> float:
        """Get quality thresholds"""
        thresholds = {
            QualityDimension.ACCURACY: 0.90,
            QualityDimension.COMPLETENESS: 0.95,
            QualityDimension.CONSISTENCY: 0.90,
            QualityDimension.TIMELINESS: 0.95,
            QualityDimension.VALIDITY: 0.92,
            QualityDimension.UNIQUENESS: 0.98
        }
        return thresholds.get(dimension, 0.85)
    
    def register_node(self, node: LineageNode):
        """Register a new node in the lineage graph"""
        self.nodes[node.node_id] = node
        self.lineage_graph.add_node(
            node.node_id,
            **asdict(node)
        )
        logger.info(f"Registered node: {node.node_id} ({node.node_type.value})")
    
    def register_edge(self, edge: LineageEdge):
        """Register a new edge in the lineage graph"""
        edge_id = f"{edge.source_id}_{edge.target_id}"
        self.edges[edge_id] = edge
        self.lineage_graph.add_edge(
            edge.source_id,
            edge.target_id,
            **asdict(edge)
        )
        logger.info(f"Registered edge: {edge.source_id} -> {edge.target_id}")
    
    async def get_upstream_lineage(self, node_id: str, depth: int = 3) -> Dict[str, Any]:
        """Get upstream lineage for a node"""
        if node_id not in self.nodes:
            raise ValueError(f"Node {node_id} not found")
        
        upstream_nodes = []
        visited = set()
        
        def traverse_upstream(current_id: str, current_depth: int):
            if current_depth >= depth or current_id in visited:
                return
            
            visited.add(current_id)
            predecessors = list(self.lineage_graph.predecessors(current_id))
            
            for pred_id in predecessors:
                if pred_id in self.nodes:
                    upstream_nodes.append({
                        "node": asdict(self.nodes[pred_id]),
                        "depth": current_depth,
                        "relationship": self.lineage_graph[pred_id][current_id].get("relationship_type", "unknown")
                    })
                    traverse_upstream(pred_id, current_depth + 1)
        
        traverse_upstream(node_id, 0)
        
        return {
            "target_node": asdict(self.nodes[node_id]),
            "upstream_dependencies": upstream_nodes,
            "total_upstream_nodes": len(upstream_nodes),
            "analysis_timestamp": datetime.now().isoformat()
        }
    
    async def get_downstream_lineage(self, node_id: str, depth: int = 3) -> Dict[str, Any]:
        """Get downstream lineage for a node"""
        if node_id not in self.nodes:
            raise ValueError(f"Node {node_id} not found")
        
        downstream_nodes = []
        visited = set()
        
        def traverse_downstream(current_id: str, current_depth: int):
            if current_depth >= depth or current_id in visited:
                return
            
            visited.add(current_id)
            successors = list(self.lineage_graph.successors(current_id))
            
            for succ_id in successors:
                if succ_id in self.nodes:
                    downstream_nodes.append({
                        "node": asdict(self.nodes[succ_id]),
                        "depth": current_depth,
                        "relationship": self.lineage_graph[current_id][succ_id].get("relationship_type", "unknown")
                    })
                    traverse_downstream(succ_id, current_depth + 1)
        
        traverse_downstream(node_id, 0)
        
        return {
            "source_node": asdict(self.nodes[node_id]),
            "downstream_dependencies": downstream_nodes,
            "total_downstream_nodes": len(downstream_nodes),
            "analysis_timestamp": datetime.now().isoformat()
        }
    
    async def get_complete_lineage(self, node_id: str, depth: int = 3) -> Dict[str, Any]:
        """Get complete lineage (both upstream and downstream) for a node"""
        upstream = await self.get_upstream_lineage(node_id, depth)
        downstream = await self.get_downstream_lineage(node_id, depth)
        
        return {
            "target_node": asdict(self.nodes[node_id]),
            "upstream_lineage": upstream["upstream_dependencies"],
            "downstream_lineage": downstream["downstream_dependencies"],
            "lineage_summary": {
                "total_upstream_nodes": len(upstream["upstream_dependencies"]),
                "total_downstream_nodes": len(downstream["downstream_dependencies"]),
                "total_connected_nodes": len(upstream["upstream_dependencies"]) + len(downstream["downstream_dependencies"])
            },
            "analysis_timestamp": datetime.now().isoformat()
        }
    
    async def perform_impact_analysis(self, node_id: str, change_type: str = "data_quality_issue") -> ImpactAnalysis:
        """Perform impact analysis for a node change"""
        if node_id not in self.nodes:
            raise ValueError(f"Node {node_id} not found")
        
        # Get all downstream nodes
        downstream = await self.get_downstream_lineage(node_id, depth=10)
        affected_nodes = [node["node"]["node_id"] for node in downstream["downstream_dependencies"]]
        
        # Calculate impact score based on various factors
        impact_score = self._calculate_impact_score(node_id, affected_nodes, change_type)
        
        # Generate recommendations
        recommendations = self._generate_impact_recommendations(node_id, affected_nodes, change_type, impact_score)
        
        analysis = ImpactAnalysis(
            analysis_id=f"impact_{node_id}_{datetime.now().strftime('%Y%m%d%H%M%S')}",
            source_node_id=node_id,
            affected_nodes=affected_nodes,
            impact_score=impact_score,
            impact_type=change_type,
            analysis_timestamp=datetime.now().isoformat(),
            recommendations=recommendations
        )
        
        self.impact_analyses[analysis.analysis_id] = analysis
        
        logger.info(f"Impact analysis completed for {node_id}: {len(affected_nodes)} nodes affected, impact score: {impact_score:.2f}")
        
        return analysis
    
    def _calculate_impact_score(self, source_node_id: str, affected_nodes: List[str], change_type: str) -> float:
        """Calculate impact score based on various factors"""
        base_score = 0.0
        
        # Factor 1: Number of affected nodes
        node_count_factor = min(len(affected_nodes) / 10.0, 1.0) * 30
        
        # Factor 2: Type of affected nodes
        node_type_factor = 0.0
        for node_id in affected_nodes:
            if node_id in self.nodes:
                node_type = self.nodes[node_id].node_type
                if node_type == NodeType.MODEL:
                    node_type_factor += 25  # Models have high impact
                elif node_type == NodeType.DATASET:
                    node_type_factor += 15  # Datasets have medium impact
                elif node_type == NodeType.TRANSFORMATION:
                    node_type_factor += 10  # Transformations have lower impact
        
        # Factor 3: Change type severity
        change_type_multiplier = {
            "data_quality_issue": 1.2,
            "schema_change": 1.5,
            "system_failure": 2.0,
            "security_breach": 2.5,
            "data_corruption": 2.0
        }.get(change_type, 1.0)
        
        # Factor 4: Business criticality (based on tags)
        criticality_factor = 0.0
        source_node = self.nodes.get(source_node_id)
        if source_node:
            critical_tags = ["production", "real-time", "customer-facing", "revenue-critical"]
            if any(tag in source_node.tags for tag in critical_tags):
                criticality_factor = 20
        
        base_score = (node_count_factor + min(node_type_factor, 40) + criticality_factor) * change_type_multiplier
        
        return min(base_score, 100.0)  # Cap at 100
    
    def _generate_impact_recommendations(self, source_node_id: str, affected_nodes: List[str], 
                                       change_type: str, impact_score: float) -> List[str]:
        """Generate recommendations based on impact analysis"""
        recommendations = []
        
        if impact_score >= 80:
            recommendations.append("CRITICAL: Immediate action required - consider emergency rollback procedures")
            recommendations.append("Activate incident response team and notify stakeholders immediately")
        elif impact_score >= 60:
            recommendations.append("HIGH PRIORITY: Schedule urgent maintenance window for remediation")
            recommendations.append("Implement temporary workarounds to minimize business impact")
        elif impact_score >= 40:
            recommendations.append("MEDIUM PRIORITY: Plan remediation within next business cycle")
            recommendations.append("Monitor affected systems closely for performance degradation")
        else:
            recommendations.append("LOW PRIORITY: Address during regular maintenance cycle")
        
        # Specific recommendations based on change type
        if change_type == "data_quality_issue":
            recommendations.append("Implement data quality monitoring and alerting")
            recommendations.append("Review and strengthen data validation rules")
        elif change_type == "schema_change":
            recommendations.append("Update downstream transformations and models")
            recommendations.append("Implement schema versioning and backward compatibility")
        elif change_type == "system_failure":
            recommendations.append("Activate backup systems and failover procedures")
            recommendations.append("Review system redundancy and disaster recovery plans")
        
        # Node-specific recommendations
        model_nodes = [nid for nid in affected_nodes if nid in self.nodes and self.nodes[nid].node_type == NodeType.MODEL]
        if model_nodes:
            recommendations.append(f"Retrain/validate {len(model_nodes)} affected AI models")
            recommendations.append("Implement model performance monitoring and drift detection")
        
        return recommendations
    
    async def get_data_quality_report(self, node_id: str) -> Dict[str, Any]:
        """Get comprehensive data quality report for a node"""
        if node_id not in self.nodes:
            raise ValueError(f"Node {node_id} not found")
        
        node_metrics = self.quality_metrics.get(node_id, [])
        
        # Calculate overall quality score
        if node_metrics:
            overall_score = sum(metric.value for metric in node_metrics) / len(node_metrics)
        else:
            overall_score = 0.0
        
        # Group metrics by dimension
        metrics_by_dimension = {}
        for metric in node_metrics:
            dimension = metric.dimension.value
            if dimension not in metrics_by_dimension:
                metrics_by_dimension[dimension] = []
            metrics_by_dimension[dimension].append(asdict(metric))
        
        # Identify quality issues
        quality_issues = []
        for metric in node_metrics:
            if metric.status == "failed":
                quality_issues.append({
                    "dimension": metric.dimension.value,
                    "current_value": metric.value,
                    "threshold": metric.threshold,
                    "severity": "high" if metric.value < metric.threshold * 0.8 else "medium"
                })
        
        return {
            "node_id": node_id,
            "node_name": self.nodes[node_id].name,
            "overall_quality_score": overall_score,
            "quality_grade": self._get_quality_grade(overall_score),
            "metrics_by_dimension": metrics_by_dimension,
            "quality_issues": quality_issues,
            "total_metrics": len(node_metrics),
            "passed_metrics": len([m for m in node_metrics if m.status == "passed"]),
            "failed_metrics": len([m for m in node_metrics if m.status == "failed"]),
            "report_timestamp": datetime.now().isoformat()
        }
    
    def _get_quality_grade(self, score: float) -> str:
        """Convert quality score to grade"""
        if score >= 0.95:
            return "A+"
        elif score >= 0.90:
            return "A"
        elif score >= 0.85:
            return "B+"
        elif score >= 0.80:
            return "B"
        elif score >= 0.75:
            return "C+"
        elif score >= 0.70:
            return "C"
        else:
            return "D"
    
    async def search_lineage(self, query: str, node_types: List[NodeType] = None) -> List[Dict[str, Any]]:
        """Search lineage nodes by name, description, or tags"""
        results = []
        
        query_lower = query.lower()
        
        for node_id, node in self.nodes.items():
            # Skip if node type filter is specified and doesn't match
            if node_types and node.node_type not in node_types:
                continue
            
            # Search in name, description, and tags
            if (query_lower in node.name.lower() or 
                query_lower in node.description.lower() or
                any(query_lower in tag.lower() for tag in node.tags)):
                
                results.append({
                    "node": asdict(node),
                    "relevance_score": self._calculate_search_relevance(query_lower, node)
                })
        
        # Sort by relevance score
        results.sort(key=lambda x: x["relevance_score"], reverse=True)
        
        return results
    
    def _calculate_search_relevance(self, query: str, node: LineageNode) -> float:
        """Calculate search relevance score"""
        score = 0.0
        
        # Exact match in name gets highest score
        if query in node.name.lower():
            score += 10.0
        
        # Partial match in name
        if any(word in node.name.lower() for word in query.split()):
            score += 5.0
        
        # Match in description
        if query in node.description.lower():
            score += 3.0
        
        # Match in tags
        for tag in node.tags:
            if query in tag.lower():
                score += 2.0
        
        return score
    
    async def get_lineage_statistics(self) -> Dict[str, Any]:
        """Get comprehensive lineage statistics"""
        total_nodes = len(self.nodes)
        total_edges = len(self.edges)
        
        # Node type distribution
        node_type_distribution = {}
        for node_type in NodeType:
            count = len([n for n in self.nodes.values() if n.node_type == node_type])
            node_type_distribution[node_type.value] = count
        
        # Quality metrics summary
        total_quality_metrics = sum(len(metrics) for metrics in self.quality_metrics.values())
        passed_metrics = sum(len([m for m in metrics if m.status == "passed"]) for metrics in self.quality_metrics.values())
        
        # Graph connectivity metrics
        if total_nodes > 0:
            avg_degree = sum(dict(self.lineage_graph.degree()).values()) / total_nodes
            connected_components = nx.number_connected_components(self.lineage_graph.to_undirected())
        else:
            avg_degree = 0
            connected_components = 0
        
        return {
            "lineage_overview": {
                "total_nodes": total_nodes,
                "total_edges": total_edges,
                "node_type_distribution": node_type_distribution,
                "average_node_degree": round(avg_degree, 2),
                "connected_components": connected_components
            },
            "quality_metrics": {
                "total_metrics": total_quality_metrics,
                "passed_metrics": passed_metrics,
                "failed_metrics": total_quality_metrics - passed_metrics,
                "quality_pass_rate": round((passed_metrics / total_quality_metrics * 100) if total_quality_metrics > 0 else 0, 2)
            },
            "impact_analyses": {
                "total_analyses": len(self.impact_analyses),
                "high_impact_analyses": len([a for a in self.impact_analyses.values() if a.impact_score >= 70])
            },
            "system_health": {
                "lineage_completeness": self._calculate_lineage_completeness(),
                "data_freshness_score": self._calculate_data_freshness_score(),
                "overall_health_score": self._calculate_overall_health_score()
            },
            "statistics_timestamp": datetime.now().isoformat()
        }
    
    def _calculate_lineage_completeness(self) -> float:
        """Calculate lineage completeness score"""
        # Simple heuristic: nodes with both upstream and downstream connections are more complete
        complete_nodes = 0
        for node_id in self.nodes:
            has_upstream = len(list(self.lineage_graph.predecessors(node_id))) > 0
            has_downstream = len(list(self.lineage_graph.successors(node_id))) > 0
            if has_upstream or has_downstream:
                complete_nodes += 1
        
        return (complete_nodes / len(self.nodes) * 100) if self.nodes else 0
    
    def _calculate_data_freshness_score(self) -> float:
        """Calculate data freshness score"""
        # Simple heuristic based on node update times
        now = datetime.now()
        fresh_nodes = 0
        
        for node in self.nodes.values():
            updated_at = datetime.fromisoformat(node.updated_at.replace('Z', '+00:00').replace('+00:00', ''))
            hours_since_update = (now - updated_at).total_seconds() / 3600
            
            if hours_since_update <= 24:  # Fresh if updated within 24 hours
                fresh_nodes += 1
        
        return (fresh_nodes / len(self.nodes) * 100) if self.nodes else 0
    
    def _calculate_overall_health_score(self) -> float:
        """Calculate overall system health score"""
        # Weighted average of various health metrics
        completeness = self._calculate_lineage_completeness()
        freshness = self._calculate_data_freshness_score()
        
        total_quality_metrics = sum(len(metrics) for metrics in self.quality_metrics.values())
        passed_metrics = sum(len([m for m in metrics if m.status == "passed"]) for metrics in self.quality_metrics.values())
        quality_score = (passed_metrics / total_quality_metrics * 100) if total_quality_metrics > 0 else 0
        
        # Weighted average
        health_score = (completeness * 0.3 + freshness * 0.3 + quality_score * 0.4)
        
        return round(health_score, 2)
    
    async def export_lineage_report(self, format: str = "json") -> str:
        """Export comprehensive lineage report"""
        report_data = {
            "report_metadata": {
                "generated_at": datetime.now().isoformat(),
                "report_type": "comprehensive_lineage_report",
                "format": format,
                "system_version": "v2.1.0"
            },
            "lineage_statistics": await self.get_lineage_statistics(),
            "nodes": {node_id: asdict(node) for node_id, node in self.nodes.items()},
            "edges": {edge_id: asdict(edge) for edge_id, edge in self.edges.items()},
            "quality_metrics": {
                node_id: [asdict(metric) for metric in metrics] 
                for node_id, metrics in self.quality_metrics.items()
            },
            "impact_analyses": {
                analysis_id: asdict(analysis) 
                for analysis_id, analysis in self.impact_analyses.items()
            }
        }
        
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"lineage_report_{timestamp}.{format}"
        
        if format == "json":
            with open(filename, 'w') as f:
                json.dump(report_data, f, indent=2)
        else:
            raise ValueError(f"Unsupported format: {format}")
        
        logger.info(f"Lineage report exported: {filename}")
        return filename

async def main():
    """Main execution function"""
    lineage_system = DataLineageSystem()
    
    logger.info("Starting Data Lineage System...")
    
    # Demonstrate lineage queries
    print("\n=== UPSTREAM LINEAGE ANALYSIS ===")
    upstream = await lineage_system.get_upstream_lineage("model_ai_concierge", depth=5)
    print(f"AI Concierge Model has {upstream['total_upstream_nodes']} upstream dependencies")
    
    print("\n=== DOWNSTREAM IMPACT ANALYSIS ===")
    impact = await lineage_system.perform_impact_analysis("src_flight_data", "data_quality_issue")
    print(f"Flight data issue affects {len(impact.affected_nodes)} downstream nodes")
    print(f"Impact Score: {impact.impact_score:.1f}/100")
    
    print("\n=== DATA QUALITY REPORT ===")
    quality_report = await lineage_system.get_data_quality_report("dataset_flight_clean")
    print(f"Data Quality Grade: {quality_report['quality_grade']}")
    print(f"Overall Score: {quality_report['overall_quality_score']:.3f}")
    
    print("\n=== LINEAGE SEARCH ===")
    search_results = await lineage_system.search_lineage("flight", [NodeType.DATASET])
    print(f"Found {len(search_results)} datasets matching 'flight'")
    
    print("\n=== SYSTEM STATISTICS ===")
    stats = await lineage_system.get_lineage_statistics()
    print(f"Total Nodes: {stats['lineage_overview']['total_nodes']}")
    print(f"Total Edges: {stats['lineage_overview']['total_edges']}")
    print(f"Overall Health Score: {stats['system_health']['overall_health_score']:.1f}%")
    
    # Export comprehensive report
    report_file = await lineage_system.export_lineage_report("json")
    print(f"\nComprehensive report exported: {report_file}")

if __name__ == "__main__":
    asyncio.run(main()) 