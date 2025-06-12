#!/usr/bin/env python3
"""
Enhanced AI Model Drift Detection System
Monitors data drift, concept drift, and performance degradation with automated alerting
"""

import numpy as np
import pandas as pd
from typing import Dict, List, Tuple, Any, Optional
from dataclasses import dataclass
from datetime import datetime, timedelta
import logging
import json
import pickle
from pathlib import Path
import warnings
from scipy import stats
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score
from sklearn.preprocessing import StandardScaler
from sklearn.decomposition import PCA
import matplotlib.pyplot as plt
import seaborn as sns
from evidently import ColumnMapping
from evidently.report import Report
from evidently.metric_preset import DataDriftPreset, TargetDriftPreset
import mlflow
import requests

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@dataclass
class DriftAlert:
    """Data class for drift alerts"""
    alert_id: str
    model_name: str
    drift_type: str
    severity: str
    metric_name: str
    current_value: float
    threshold: float
    timestamp: datetime
    description: str
    recommended_action: str

@dataclass
class ModelMetrics:
    """Data class for model performance metrics"""
    accuracy: float
    precision: float
    recall: float
    f1_score: float
    auc_roc: Optional[float] = None
    timestamp: datetime = None

class StatisticalTests:
    """Statistical tests for drift detection"""
    
    @staticmethod
    def kolmogorov_smirnov_test(reference: np.ndarray, current: np.ndarray, 
                               alpha: float = 0.05) -> Tuple[float, bool]:
        """Perform Kolmogorov-Smirnov test for distribution drift"""
        statistic, p_value = stats.ks_2samp(reference, current)
        is_drift = p_value < alpha
        return p_value, is_drift
    
    @staticmethod
    def chi_square_test(reference: np.ndarray, current: np.ndarray, 
                       alpha: float = 0.05) -> Tuple[float, bool]:
        """Perform Chi-square test for categorical drift"""
        try:
            # Create contingency table
            ref_counts = pd.Series(reference).value_counts().sort_index()
            cur_counts = pd.Series(current).value_counts().sort_index()
            
            # Align indices
            all_categories = ref_counts.index.union(cur_counts.index)
            ref_aligned = ref_counts.reindex(all_categories, fill_value=0)
            cur_aligned = cur_counts.reindex(all_categories, fill_value=0)
            
            # Perform test
            statistic, p_value = stats.chisquare(cur_aligned, ref_aligned)
            is_drift = p_value < alpha
            return p_value, is_drift
        except Exception as e:
            logger.warning(f"Chi-square test failed: {e}")
            return 1.0, False
    
    @staticmethod
    def population_stability_index(reference: np.ndarray, current: np.ndarray, 
                                 bins: int = 10) -> float:
        """Calculate Population Stability Index (PSI)"""
        try:
            # Create bins based on reference data
            _, bin_edges = np.histogram(reference, bins=bins)
            
            # Calculate distributions
            ref_dist, _ = np.histogram(reference, bins=bin_edges)
            cur_dist, _ = np.histogram(current, bins=bin_edges)
            
            # Normalize to get proportions
            ref_prop = ref_dist / len(reference)
            cur_prop = cur_dist / len(current)
            
            # Add small epsilon to avoid log(0)
            epsilon = 1e-10
            ref_prop = np.maximum(ref_prop, epsilon)
            cur_prop = np.maximum(cur_prop, epsilon)
            
            # Calculate PSI
            psi = np.sum((cur_prop - ref_prop) * np.log(cur_prop / ref_prop))
            return psi
        except Exception as e:
            logger.warning(f"PSI calculation failed: {e}")
            return 0.0

class DriftDetector:
    """Main drift detection class"""
    
    def __init__(self, model_name: str, config: Dict[str, Any]):
        self.model_name = model_name
        self.config = config
        self.reference_data = None
        self.reference_predictions = None
        self.reference_metrics = None
        self.drift_history = []
        self.alert_history = []
        
        # Thresholds
        self.psi_threshold = config.get('psi_threshold', 0.2)
        self.ks_alpha = config.get('ks_alpha', 0.05)
        self.performance_threshold = config.get('performance_threshold', 0.05)
        self.min_samples = config.get('min_samples', 100)
        
        # Initialize statistical tests
        self.stats_tests = StatisticalTests()
        
        # Setup MLflow tracking
        self.setup_mlflow()
    
    def setup_mlflow(self):
        """Setup MLflow for experiment tracking"""
        try:
            mlflow.set_tracking_uri(self.config.get('mlflow_uri', 'http://mlflow:5000'))
            mlflow.set_experiment(f"drift_detection_{self.model_name}")
        except Exception as e:
            logger.warning(f"MLflow setup failed: {e}")
    
    def set_reference_data(self, X_ref: pd.DataFrame, y_ref: np.ndarray, 
                          predictions_ref: np.ndarray):
        """Set reference data for drift detection"""
        self.reference_data = X_ref.copy()
        self.reference_predictions = predictions_ref
        
        # Calculate reference metrics
        self.reference_metrics = ModelMetrics(
            accuracy=accuracy_score(y_ref, predictions_ref),
            precision=precision_score(y_ref, predictions_ref, average='weighted', zero_division=0),
            recall=recall_score(y_ref, predictions_ref, average='weighted', zero_division=0),
            f1_score=f1_score(y_ref, predictions_ref, average='weighted', zero_division=0),
            timestamp=datetime.now()
        )
        
        logger.info(f"Reference data set for {self.model_name}")
        logger.info(f"Reference metrics: {self.reference_metrics}")
    
    def detect_data_drift(self, X_current: pd.DataFrame) -> Dict[str, Any]:
        """Detect data drift using multiple statistical tests"""
        if self.reference_data is None:
            raise ValueError("Reference data not set. Call set_reference_data() first.")
        
        drift_results = {
            'timestamp': datetime.now(),
            'overall_drift': False,
            'feature_drift': {},
            'drift_score': 0.0,
            'alerts': []
        }
        
        drift_features = 0
        total_features = len(self.reference_data.columns)
        
        for feature in self.reference_data.columns:
            try:
                ref_values = self.reference_data[feature].dropna()
                cur_values = X_current[feature].dropna()
                
                if len(ref_values) < self.min_samples or len(cur_values) < self.min_samples:
                    continue
                
                feature_drift = {
                    'feature': feature,
                    'drift_detected': False,
                    'tests': {}
                }
                
                # Determine if feature is numerical or categorical
                if pd.api.types.is_numeric_dtype(ref_values):
                    # Numerical feature tests
                    
                    # Kolmogorov-Smirnov test
                    ks_p_value, ks_drift = self.stats_tests.kolmogorov_smirnov_test(
                        ref_values.values, cur_values.values, self.ks_alpha
                    )
                    feature_drift['tests']['ks_test'] = {
                        'p_value': ks_p_value,
                        'drift': ks_drift
                    }
                    
                    # Population Stability Index
                    psi_score = self.stats_tests.population_stability_index(
                        ref_values.values, cur_values.values
                    )
                    psi_drift = psi_score > self.psi_threshold
                    feature_drift['tests']['psi'] = {
                        'score': psi_score,
                        'drift': psi_drift
                    }
                    
                    # Overall feature drift
                    feature_drift['drift_detected'] = ks_drift or psi_drift
                    
                else:
                    # Categorical feature tests
                    chi2_p_value, chi2_drift = self.stats_tests.chi_square_test(
                        ref_values.values, cur_values.values, self.ks_alpha
                    )
                    feature_drift['tests']['chi2_test'] = {
                        'p_value': chi2_p_value,
                        'drift': chi2_drift
                    }
                    
                    feature_drift['drift_detected'] = chi2_drift
                
                drift_results['feature_drift'][feature] = feature_drift
                
                if feature_drift['drift_detected']:
                    drift_features += 1
                    
                    # Create alert for significant drift
                    alert = DriftAlert(
                        alert_id=f"DRIFT_{self.model_name}_{feature}_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
                        model_name=self.model_name,
                        drift_type='data_drift',
                        severity='medium' if drift_features / total_features < 0.3 else 'high',
                        metric_name=feature,
                        current_value=psi_score if 'psi' in feature_drift['tests'] else ks_p_value,
                        threshold=self.psi_threshold if 'psi' in feature_drift['tests'] else self.ks_alpha,
                        timestamp=datetime.now(),
                        description=f"Data drift detected in feature '{feature}'",
                        recommended_action="Investigate data source changes and consider model retraining"
                    )
                    drift_results['alerts'].append(alert)
            
            except Exception as e:
                logger.warning(f"Drift detection failed for feature {feature}: {e}")
                continue
        
        # Calculate overall drift score
        drift_results['drift_score'] = drift_features / total_features if total_features > 0 else 0
        drift_results['overall_drift'] = drift_results['drift_score'] > 0.2  # 20% threshold
        
        return drift_results
    
    def detect_concept_drift(self, y_true: np.ndarray, y_pred: np.ndarray) -> Dict[str, Any]:
        """Detect concept drift by comparing model performance"""
        if self.reference_metrics is None:
            raise ValueError("Reference metrics not set. Call set_reference_data() first.")
        
        # Calculate current metrics
        current_metrics = ModelMetrics(
            accuracy=accuracy_score(y_true, y_pred),
            precision=precision_score(y_true, y_pred, average='weighted', zero_division=0),
            recall=recall_score(y_true, y_pred, average='weighted', zero_division=0),
            f1_score=f1_score(y_true, y_pred, average='weighted', zero_division=0),
            timestamp=datetime.now()
        )
        
        drift_results = {
            'timestamp': datetime.now(),
            'concept_drift': False,
            'performance_degradation': {},
            'current_metrics': current_metrics,
            'reference_metrics': self.reference_metrics,
            'alerts': []
        }
        
        # Check each metric for significant degradation
        metrics_to_check = ['accuracy', 'precision', 'recall', 'f1_score']
        
        for metric in metrics_to_check:
            ref_value = getattr(self.reference_metrics, metric)
            cur_value = getattr(current_metrics, metric)
            
            degradation = ref_value - cur_value
            degradation_pct = (degradation / ref_value) * 100 if ref_value > 0 else 0
            
            is_significant = degradation > self.performance_threshold
            
            drift_results['performance_degradation'][metric] = {
                'reference': ref_value,
                'current': cur_value,
                'degradation': degradation,
                'degradation_pct': degradation_pct,
                'significant': is_significant
            }
            
            if is_significant:
                drift_results['concept_drift'] = True
                
                # Create alert
                severity = 'high' if degradation_pct > 10 else 'medium'
                alert = DriftAlert(
                    alert_id=f"CONCEPT_{self.model_name}_{metric}_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
                    model_name=self.model_name,
                    drift_type='concept_drift',
                    severity=severity,
                    metric_name=metric,
                    current_value=cur_value,
                    threshold=ref_value - self.performance_threshold,
                    timestamp=datetime.now(),
                    description=f"Concept drift detected: {metric} degraded by {degradation_pct:.2f}%",
                    recommended_action="Immediate model retraining recommended"
                )
                drift_results['alerts'].append(alert)
        
        return drift_results
    
    def detect_prediction_drift(self, predictions_current: np.ndarray) -> Dict[str, Any]:
        """Detect drift in model predictions"""
        if self.reference_predictions is None:
            raise ValueError("Reference predictions not set. Call set_reference_data() first.")
        
        drift_results = {
            'timestamp': datetime.now(),
            'prediction_drift': False,
            'drift_metrics': {},
            'alerts': []
        }
        
        try:
            # PSI for prediction distributions
            psi_score = self.stats_tests.population_stability_index(
                self.reference_predictions, predictions_current
            )
            
            # KS test for prediction distributions
            ks_p_value, ks_drift = self.stats_tests.kolmogorov_smirnov_test(
                self.reference_predictions, predictions_current, self.ks_alpha
            )
            
            drift_results['drift_metrics'] = {
                'psi_score': psi_score,
                'psi_drift': psi_score > self.psi_threshold,
                'ks_p_value': ks_p_value,
                'ks_drift': ks_drift
            }
            
            drift_results['prediction_drift'] = (psi_score > self.psi_threshold) or ks_drift
            
            if drift_results['prediction_drift']:
                alert = DriftAlert(
                    alert_id=f"PRED_{self.model_name}_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
                    model_name=self.model_name,
                    drift_type='prediction_drift',
                    severity='medium',
                    metric_name='prediction_distribution',
                    current_value=psi_score,
                    threshold=self.psi_threshold,
                    timestamp=datetime.now(),
                    description="Prediction distribution drift detected",
                    recommended_action="Analyze prediction patterns and consider model update"
                )
                drift_results['alerts'].append(alert)
        
        except Exception as e:
            logger.error(f"Prediction drift detection failed: {e}")
        
        return drift_results
    
    def comprehensive_drift_analysis(self, X_current: pd.DataFrame, 
                                   y_true: Optional[np.ndarray] = None,
                                   y_pred: Optional[np.ndarray] = None,
                                   predictions_current: Optional[np.ndarray] = None) -> Dict[str, Any]:
        """Perform comprehensive drift analysis"""
        
        analysis_results = {
            'timestamp': datetime.now(),
            'model_name': self.model_name,
            'data_drift': None,
            'concept_drift': None,
            'prediction_drift': None,
            'overall_risk': 'low',
            'all_alerts': [],
            'recommendations': []
        }
        
        # Data drift analysis
        try:
            data_drift_results = self.detect_data_drift(X_current)
            analysis_results['data_drift'] = data_drift_results
            analysis_results['all_alerts'].extend(data_drift_results['alerts'])
        except Exception as e:
            logger.error(f"Data drift analysis failed: {e}")
        
        # Concept drift analysis (if ground truth available)
        if y_true is not None and y_pred is not None:
            try:
                concept_drift_results = self.detect_concept_drift(y_true, y_pred)
                analysis_results['concept_drift'] = concept_drift_results
                analysis_results['all_alerts'].extend(concept_drift_results['alerts'])
            except Exception as e:
                logger.error(f"Concept drift analysis failed: {e}")
        
        # Prediction drift analysis
        if predictions_current is not None:
            try:
                prediction_drift_results = self.detect_prediction_drift(predictions_current)
                analysis_results['prediction_drift'] = prediction_drift_results
                analysis_results['all_alerts'].extend(prediction_drift_results['alerts'])
            except Exception as e:
                logger.error(f"Prediction drift analysis failed: {e}")
        
        # Determine overall risk level
        high_severity_alerts = [a for a in analysis_results['all_alerts'] if a.severity == 'high']
        medium_severity_alerts = [a for a in analysis_results['all_alerts'] if a.severity == 'medium']
        
        if high_severity_alerts:
            analysis_results['overall_risk'] = 'high'
        elif medium_severity_alerts:
            analysis_results['overall_risk'] = 'medium'
        else:
            analysis_results['overall_risk'] = 'low'
        
        # Generate recommendations
        analysis_results['recommendations'] = self.generate_recommendations(analysis_results)
        
        # Log to MLflow
        self.log_to_mlflow(analysis_results)
        
        # Store in history
        self.drift_history.append(analysis_results)
        self.alert_history.extend(analysis_results['all_alerts'])
        
        return analysis_results
    
    def generate_recommendations(self, analysis_results: Dict[str, Any]) -> List[str]:
        """Generate actionable recommendations based on drift analysis"""
        recommendations = []
        
        # Data drift recommendations
        if analysis_results.get('data_drift', {}).get('overall_drift', False):
            drift_score = analysis_results['data_drift']['drift_score']
            if drift_score > 0.5:
                recommendations.append("URGENT: Significant data drift detected (>50% features). Immediate investigation required.")
                recommendations.append("Consider emergency model retraining with recent data.")
            elif drift_score > 0.2:
                recommendations.append("Moderate data drift detected. Schedule model retraining within 1 week.")
                recommendations.append("Investigate data source changes and data quality issues.")
        
        # Concept drift recommendations
        if analysis_results.get('concept_drift', {}).get('concept_drift', False):
            recommendations.append("Concept drift detected - model performance degraded.")
            recommendations.append("Retrain model with recent labeled data immediately.")
            recommendations.append("Consider ensemble methods or online learning approaches.")
        
        # Prediction drift recommendations
        if analysis_results.get('prediction_drift', {}).get('prediction_drift', False):
            recommendations.append("Prediction distribution has shifted significantly.")
            recommendations.append("Analyze business impact of prediction changes.")
            recommendations.append("Consider prediction calibration or threshold adjustment.")
        
        # General recommendations
        if analysis_results['overall_risk'] == 'high':
            recommendations.append("HIGH RISK: Multiple drift types detected. Escalate to AI governance team.")
            recommendations.append("Implement temporary monitoring and manual review processes.")
        elif analysis_results['overall_risk'] == 'medium':
            recommendations.append("MEDIUM RISK: Monitor closely and prepare for model update.")
        
        if not recommendations:
            recommendations.append("No significant drift detected. Continue regular monitoring.")
        
        return recommendations
    
    def log_to_mlflow(self, analysis_results: Dict[str, Any]):
        """Log drift analysis results to MLflow"""
        try:
            with mlflow.start_run():
                # Log metrics
                if analysis_results.get('data_drift'):
                    mlflow.log_metric("data_drift_score", analysis_results['data_drift']['drift_score'])
                    mlflow.log_metric("data_drift_detected", int(analysis_results['data_drift']['overall_drift']))
                
                if analysis_results.get('concept_drift'):
                    current_metrics = analysis_results['concept_drift']['current_metrics']
                    mlflow.log_metric("current_accuracy", current_metrics.accuracy)
                    mlflow.log_metric("current_f1", current_metrics.f1_score)
                    mlflow.log_metric("concept_drift_detected", int(analysis_results['concept_drift']['concept_drift']))
                
                if analysis_results.get('prediction_drift'):
                    drift_metrics = analysis_results['prediction_drift']['drift_metrics']
                    mlflow.log_metric("prediction_psi", drift_metrics.get('psi_score', 0))
                    mlflow.log_metric("prediction_drift_detected", int(analysis_results['prediction_drift']['prediction_drift']))
                
                # Log overall risk
                risk_mapping = {'low': 0, 'medium': 1, 'high': 2}
                mlflow.log_metric("overall_risk_level", risk_mapping[analysis_results['overall_risk']])
                mlflow.log_metric("total_alerts", len(analysis_results['all_alerts']))
                
                # Log artifacts
                mlflow.log_dict(analysis_results, "drift_analysis_results.json")
        
        except Exception as e:
            logger.warning(f"MLflow logging failed: {e}")
    
    def send_alerts(self, alerts: List[DriftAlert]):
        """Send alerts to configured endpoints"""
        for alert in alerts:
            try:
                # Send to governance dashboard
                self.send_to_dashboard(alert)
                
                # Send email for high severity
                if alert.severity == 'high':
                    self.send_email_alert(alert)
                
                # Send to Slack/Teams
                self.send_chat_alert(alert)
                
            except Exception as e:
                logger.error(f"Failed to send alert {alert.alert_id}: {e}")
    
    def send_to_dashboard(self, alert: DriftAlert):
        """Send alert to governance dashboard"""
        dashboard_url = self.config.get('dashboard_url', 'http://governance-dashboard:8501/api/alerts')
        
        alert_data = {
            'alert_id': alert.alert_id,
            'model_name': alert.model_name,
            'drift_type': alert.drift_type,
            'severity': alert.severity,
            'metric_name': alert.metric_name,
            'current_value': alert.current_value,
            'threshold': alert.threshold,
            'timestamp': alert.timestamp.isoformat(),
            'description': alert.description,
            'recommended_action': alert.recommended_action
        }
        
        try:
            response = requests.post(dashboard_url, json=alert_data, timeout=10)
            response.raise_for_status()
            logger.info(f"Alert {alert.alert_id} sent to dashboard")
        except Exception as e:
            logger.warning(f"Failed to send alert to dashboard: {e}")
    
    def send_email_alert(self, alert: DriftAlert):
        """Send high-severity alerts via email"""
        # Implementation would depend on email service configuration
        logger.info(f"High-severity alert {alert.alert_id} would be sent via email")
    
    def send_chat_alert(self, alert: DriftAlert):
        """Send alerts to chat platforms (Slack/Teams)"""
        # Implementation would depend on chat platform configuration
        logger.info(f"Alert {alert.alert_id} would be sent to chat platform")
    
    def generate_drift_report(self, analysis_results: Dict[str, Any]) -> str:
        """Generate comprehensive drift analysis report"""
        report = f"""
# Drift Analysis Report - {self.model_name}

**Analysis Timestamp**: {analysis_results['timestamp'].strftime('%Y-%m-%d %H:%M:%S')}
**Overall Risk Level**: {analysis_results['overall_risk'].upper()}
**Total Alerts**: {len(analysis_results['all_alerts'])}

## Summary

"""
        
        # Data drift summary
        if analysis_results.get('data_drift'):
            data_drift = analysis_results['data_drift']
            report += f"""
### Data Drift Analysis
- **Overall Drift Detected**: {data_drift['overall_drift']}
- **Drift Score**: {data_drift['drift_score']:.3f}
- **Features with Drift**: {sum(1 for f in data_drift['feature_drift'].values() if f['drift_detected'])}
- **Total Features Analyzed**: {len(data_drift['feature_drift'])}
"""
        
        # Concept drift summary
        if analysis_results.get('concept_drift'):
            concept_drift = analysis_results['concept_drift']
            current_metrics = concept_drift['current_metrics']
            reference_metrics = concept_drift['reference_metrics']
            
            report += f"""
### Concept Drift Analysis
- **Concept Drift Detected**: {concept_drift['concept_drift']}
- **Current Accuracy**: {current_metrics.accuracy:.3f}
- **Reference Accuracy**: {reference_metrics.accuracy:.3f}
- **Performance Change**: {((current_metrics.accuracy - reference_metrics.accuracy) / reference_metrics.accuracy * 100):+.2f}%
"""
        
        # Prediction drift summary
        if analysis_results.get('prediction_drift'):
            pred_drift = analysis_results['prediction_drift']
            report += f"""
### Prediction Drift Analysis
- **Prediction Drift Detected**: {pred_drift['prediction_drift']}
- **PSI Score**: {pred_drift['drift_metrics'].get('psi_score', 'N/A')}
- **KS Test p-value**: {pred_drift['drift_metrics'].get('ks_p_value', 'N/A')}
"""
        
        # Alerts section
        if analysis_results['all_alerts']:
            report += "\n## Active Alerts\n"
            for alert in analysis_results['all_alerts']:
                report += f"""
### {alert.severity.upper()} - {alert.drift_type.replace('_', ' ').title()}
- **Alert ID**: {alert.alert_id}
- **Metric**: {alert.metric_name}
- **Current Value**: {alert.current_value:.4f}
- **Threshold**: {alert.threshold:.4f}
- **Description**: {alert.description}
- **Recommended Action**: {alert.recommended_action}
"""
        
        # Recommendations section
        if analysis_results['recommendations']:
            report += "\n## Recommendations\n"
            for i, rec in enumerate(analysis_results['recommendations'], 1):
                report += f"{i}. {rec}\n"
        
        return report

class DriftMonitoringService:
    """Service for continuous drift monitoring across multiple models"""
    
    def __init__(self, config_path: str):
        self.config = self.load_config(config_path)
        self.detectors = {}
        self.setup_detectors()
    
    def load_config(self, config_path: str) -> Dict[str, Any]:
        """Load configuration from file"""
        try:
            with open(config_path, 'r') as f:
                return json.load(f)
        except Exception as e:
            logger.error(f"Failed to load config: {e}")
            return self.get_default_config()
    
    def get_default_config(self) -> Dict[str, Any]:
        """Return default configuration"""
        return {
            'models': {
                'ai-concierge': {
                    'psi_threshold': 0.2,
                    'ks_alpha': 0.05,
                    'performance_threshold': 0.05,
                    'min_samples': 100
                },
                'recommendations-engine': {
                    'psi_threshold': 0.15,
                    'ks_alpha': 0.05,
                    'performance_threshold': 0.03,
                    'min_samples': 200
                },
                'mr-concierge': {
                    'psi_threshold': 0.25,
                    'ks_alpha': 0.05,
                    'performance_threshold': 0.07,
                    'min_samples': 50
                }
            },
            'monitoring': {
                'check_interval_hours': 6,
                'dashboard_url': 'http://governance-dashboard:8501/api/alerts',
                'mlflow_uri': 'http://mlflow:5000'
            }
        }
    
    def setup_detectors(self):
        """Initialize drift detectors for all configured models"""
        for model_name, model_config in self.config['models'].items():
            self.detectors[model_name] = DriftDetector(model_name, model_config)
            logger.info(f"Initialized drift detector for {model_name}")
    
    def monitor_model(self, model_name: str, X_current: pd.DataFrame,
                     y_true: Optional[np.ndarray] = None,
                     y_pred: Optional[np.ndarray] = None,
                     predictions_current: Optional[np.ndarray] = None) -> Dict[str, Any]:
        """Monitor a specific model for drift"""
        if model_name not in self.detectors:
            raise ValueError(f"No detector configured for model: {model_name}")
        
        detector = self.detectors[model_name]
        
        # Perform comprehensive drift analysis
        analysis_results = detector.comprehensive_drift_analysis(
            X_current, y_true, y_pred, predictions_current
        )
        
        # Send alerts if any detected
        if analysis_results['all_alerts']:
            detector.send_alerts(analysis_results['all_alerts'])
        
        return analysis_results
    
    def run_continuous_monitoring(self):
        """Run continuous monitoring for all models"""
        logger.info("Starting continuous drift monitoring service")
        
        while True:
            try:
                for model_name in self.detectors.keys():
                    # In production, this would fetch real data from model endpoints
                    logger.info(f"Checking drift for {model_name}")
                    
                    # Simulate data fetching and monitoring
                    # This would be replaced with actual data fetching logic
                    
                time.sleep(self.config['monitoring']['check_interval_hours'] * 3600)
                
            except KeyboardInterrupt:
                logger.info("Monitoring service stopped by user")
                break
            except Exception as e:
                logger.error(f"Error in continuous monitoring: {e}")
                time.sleep(300)  # Wait 5 minutes before retrying

def main():
    """Main function for running drift detection service"""
    import argparse
    
    parser = argparse.ArgumentParser(description='AI Model Drift Detection Service')
    parser.add_argument('--config', default='drift_config.json', 
                       help='Path to configuration file')
    parser.add_argument('--mode', choices=['single', 'continuous'], default='continuous',
                       help='Run mode: single check or continuous monitoring')
    parser.add_argument('--model', help='Model name for single check mode')
    
    args = parser.parse_args()
    
    # Initialize monitoring service
    service = DriftMonitoringService(args.config)
    
    if args.mode == 'continuous':
        service.run_continuous_monitoring()
    else:
        if not args.model:
            logger.error("Model name required for single check mode")
            return
        
        # Single model check (would need actual data in production)
        logger.info(f"Running single drift check for {args.model}")

if __name__ == "__main__":
    main()