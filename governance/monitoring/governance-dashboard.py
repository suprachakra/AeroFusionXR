#!/usr/bin/env python3
"""
AI Governance KPI Dashboard
Real-time monitoring of governance metrics and compliance status
"""

import streamlit as st
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
from plotly.subplots import make_subplots
import numpy as np
from datetime import datetime, timedelta
import json
import requests
from typing import Dict, List, Any
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class GovernanceDashboard:
    """Main dashboard class for AI governance monitoring"""
    
    def __init__(self):
        self.setup_page_config()
        self.initialize_data_sources()
    
    def setup_page_config(self):
        """Configure Streamlit page settings"""
        st.set_page_config(
            page_title="AI Governance Dashboard",
            page_icon="🛡️",
            layout="wide",
            initial_sidebar_state="expanded"
        )
        
        # Custom CSS for better styling
        st.markdown("""
        <style>
        .metric-card {
            background-color: #f0f2f6;
            padding: 1rem;
            border-radius: 0.5rem;
            border-left: 4px solid #1f77b4;
        }
        .alert-high { border-left-color: #d62728; }
        .alert-medium { border-left-color: #ff7f0e; }
        .alert-low { border-left-color: #2ca02c; }
        .governance-header {
            background: linear-gradient(90deg, #1f77b4, #17becf);
            color: white;
            padding: 1rem;
            border-radius: 0.5rem;
            margin-bottom: 2rem;
        }
        </style>
        """, unsafe_allow_html=True)
    
    def initialize_data_sources(self):
        """Initialize connections to data sources"""
        self.data_sources = {
            'prometheus': 'http://prometheus:9090',
            'elasticsearch': 'http://elasticsearch:9200',
            'mlflow': 'http://mlflow:5000',
            'grafana': 'http://grafana:3000'
        }
    
    def fetch_governance_metrics(self) -> Dict[str, Any]:
        """Fetch current governance metrics from various sources"""
        try:
            # Simulate real data - in production, fetch from actual sources
            metrics = {
                'compliance_rate': np.random.uniform(95, 99.5),
                'bias_incidents': np.random.poisson(2),
                'model_drift_alerts': np.random.poisson(1),
                'security_violations': np.random.poisson(0.5),
                'dpia_completion_rate': np.random.uniform(92, 98),
                'model_card_coverage': np.random.uniform(88, 96),
                'training_completion_rate': np.random.uniform(85, 95),
                'incident_response_time': np.random.uniform(2, 6),
                'audit_findings': np.random.poisson(1),
                'policy_violations': np.random.poisson(0.8)
            }
            
            # Add timestamp
            metrics['last_updated'] = datetime.now()
            
            return metrics
        except Exception as e:
            logger.error(f"Error fetching governance metrics: {e}")
            return self.get_default_metrics()
    
    def get_default_metrics(self) -> Dict[str, Any]:
        """Return default metrics when data sources are unavailable"""
        return {
            'compliance_rate': 97.5,
            'bias_incidents': 1,
            'model_drift_alerts': 2,
            'security_violations': 0,
            'dpia_completion_rate': 95.0,
            'model_card_coverage': 92.0,
            'training_completion_rate': 89.0,
            'incident_response_time': 3.2,
            'audit_findings': 0,
            'policy_violations': 1,
            'last_updated': datetime.now()
        }
    
    def generate_historical_data(self, days: int = 30) -> pd.DataFrame:
        """Generate historical data for trend analysis"""
        dates = pd.date_range(
            start=datetime.now() - timedelta(days=days),
            end=datetime.now(),
            freq='D'
        )
        
        data = []
        for date in dates:
            data.append({
                'date': date,
                'compliance_rate': np.random.uniform(94, 99),
                'bias_score': np.random.uniform(0.02, 0.08),
                'model_accuracy': np.random.uniform(0.92, 0.98),
                'security_score': np.random.uniform(85, 98),
                'incidents': np.random.poisson(1.5),
                'training_hours': np.random.uniform(20, 40)
            })
        
        return pd.DataFrame(data)
    
    def render_header(self):
        """Render dashboard header"""
        st.markdown("""
        <div class="governance-header">
            <h1>🛡️ AI Governance Dashboard</h1>
            <p>Real-time monitoring of AI governance metrics and compliance status</p>
        </div>
        """, unsafe_allow_html=True)
    
    def render_kpi_cards(self, metrics: Dict[str, Any]):
        """Render KPI metric cards"""
        col1, col2, col3, col4 = st.columns(4)
        
        with col1:
            compliance_color = "green" if metrics['compliance_rate'] >= 95 else "orange"
            st.metric(
                label="📊 Compliance Rate",
                value=f"{metrics['compliance_rate']:.1f}%",
                delta=f"{np.random.uniform(-0.5, 1.2):.1f}%"
            )
        
        with col2:
            bias_color = "red" if metrics['bias_incidents'] > 3 else "green"
            st.metric(
                label="⚖️ Bias Incidents",
                value=str(metrics['bias_incidents']),
                delta=f"{np.random.randint(-2, 1)}"
            )
        
        with col3:
            drift_color = "orange" if metrics['model_drift_alerts'] > 2 else "green"
            st.metric(
                label="📈 Model Drift Alerts",
                value=str(metrics['model_drift_alerts']),
                delta=f"{np.random.randint(-1, 2)}"
            )
        
        with col4:
            security_color = "red" if metrics['security_violations'] > 0 else "green"
            st.metric(
                label="🔒 Security Violations",
                value=str(metrics['security_violations']),
                delta=f"{np.random.randint(-1, 1)}"
            )
    
    def render_compliance_overview(self, metrics: Dict[str, Any]):
        """Render compliance overview section"""
        st.subheader("📋 Compliance Overview")
        
        col1, col2 = st.columns(2)
        
        with col1:
            # Compliance gauge chart
            fig_gauge = go.Figure(go.Indicator(
                mode="gauge+number+delta",
                value=metrics['compliance_rate'],
                domain={'x': [0, 1], 'y': [0, 1]},
                title={'text': "Overall Compliance Rate"},
                delta={'reference': 95},
                gauge={
                    'axis': {'range': [None, 100]},
                    'bar': {'color': "darkblue"},
                    'steps': [
                        {'range': [0, 85], 'color': "lightgray"},
                        {'range': [85, 95], 'color': "yellow"},
                        {'range': [95, 100], 'color': "green"}
                    ],
                    'threshold': {
                        'line': {'color': "red", 'width': 4},
                        'thickness': 0.75,
                        'value': 95
                    }
                }
            ))
            fig_gauge.update_layout(height=300)
            st.plotly_chart(fig_gauge, use_container_width=True)
        
        with col2:
            # Compliance breakdown
            compliance_data = {
                'Area': ['DPIA Completion', 'Model Cards', 'Training', 'Security Reviews'],
                'Rate': [
                    metrics['dpia_completion_rate'],
                    metrics['model_card_coverage'],
                    metrics['training_completion_rate'],
                    95.5  # Security review rate
                ]
            }
            
            fig_bar = px.bar(
                compliance_data,
                x='Area',
                y='Rate',
                title="Compliance by Area",
                color='Rate',
                color_continuous_scale='RdYlGn',
                range_color=[80, 100]
            )
            fig_bar.update_layout(height=300)
            st.plotly_chart(fig_bar, use_container_width=True)
    
    def render_bias_monitoring(self):
        """Render bias monitoring section"""
        st.subheader("⚖️ Bias Monitoring")
        
        # Generate sample bias data for different models
        models = ['AI Concierge', 'Recommendations Engine', 'MR Concierge', 'Predictive Maintenance']
        bias_data = []
        
        for model in models:
            for metric in ['Demographic Parity', 'Equal Opportunity', 'Calibration']:
                bias_data.append({
                    'Model': model,
                    'Metric': metric,
                    'Score': np.random.uniform(0.02, 0.12),
                    'Threshold': 0.1,
                    'Status': 'Pass' if np.random.uniform(0.02, 0.12) < 0.1 else 'Fail'
                })
        
        bias_df = pd.DataFrame(bias_data)
        
        col1, col2 = st.columns(2)
        
        with col1:
            # Bias heatmap
            pivot_data = bias_df.pivot(index='Model', columns='Metric', values='Score')
            fig_heatmap = px.imshow(
                pivot_data,
                title="Bias Scores by Model and Metric",
                color_continuous_scale='RdYlGn_r',
                aspect="auto"
            )
            st.plotly_chart(fig_heatmap, use_container_width=True)
        
        with col2:
            # Bias status summary
            status_counts = bias_df['Status'].value_counts()
            fig_pie = px.pie(
                values=status_counts.values,
                names=status_counts.index,
                title="Bias Test Results",
                color_discrete_map={'Pass': 'green', 'Fail': 'red'}
            )
            st.plotly_chart(fig_pie, use_container_width=True)
    
    def render_model_performance(self):
        """Render model performance monitoring"""
        st.subheader("📊 Model Performance Monitoring")
        
        # Generate historical performance data
        historical_data = self.generate_historical_data(30)
        
        col1, col2 = st.columns(2)
        
        with col1:
            # Model accuracy trend
            fig_accuracy = px.line(
                historical_data,
                x='date',
                y='model_accuracy',
                title="Model Accuracy Trend (30 days)",
                labels={'model_accuracy': 'Accuracy', 'date': 'Date'}
            )
            fig_accuracy.add_hline(y=0.95, line_dash="dash", line_color="red", 
                                 annotation_text="Minimum Threshold")
            st.plotly_chart(fig_accuracy, use_container_width=True)
        
        with col2:
            # Bias score trend
            fig_bias = px.line(
                historical_data,
                x='date',
                y='bias_score',
                title="Bias Score Trend (30 days)",
                labels={'bias_score': 'Bias Score', 'date': 'Date'}
            )
            fig_bias.add_hline(y=0.1, line_dash="dash", line_color="red",
                             annotation_text="Maximum Threshold")
            st.plotly_chart(fig_bias, use_container_width=True)
    
    def render_incident_tracking(self, metrics: Dict[str, Any]):
        """Render incident tracking section"""
        st.subheader("🚨 Incident Tracking")
        
        # Generate sample incident data
        incident_types = ['Bias Detection', 'Privacy Violation', 'Security Breach', 'Model Drift']
        incidents = []
        
        for i in range(10):
            incidents.append({
                'ID': f"INC-{1000 + i}",
                'Type': np.random.choice(incident_types),
                'Severity': np.random.choice(['Low', 'Medium', 'High'], p=[0.5, 0.3, 0.2]),
                'Status': np.random.choice(['Open', 'In Progress', 'Resolved'], p=[0.2, 0.3, 0.5]),
                'Created': datetime.now() - timedelta(days=np.random.randint(0, 30)),
                'Response Time (hrs)': np.random.uniform(1, 8)
            })
        
        incidents_df = pd.DataFrame(incidents)
        
        col1, col2 = st.columns(2)
        
        with col1:
            # Incident status distribution
            status_counts = incidents_df['Status'].value_counts()
            fig_status = px.pie(
                values=status_counts.values,
                names=status_counts.index,
                title="Incident Status Distribution"
            )
            st.plotly_chart(fig_status, use_container_width=True)
        
        with col2:
            # Response time by severity
            fig_response = px.box(
                incidents_df,
                x='Severity',
                y='Response Time (hrs)',
                title="Response Time by Severity"
            )
            fig_response.add_hline(y=4, line_dash="dash", line_color="red",
                                 annotation_text="SLA Threshold")
            st.plotly_chart(fig_response, use_container_width=True)
        
        # Recent incidents table
        st.subheader("Recent Incidents")
        recent_incidents = incidents_df.sort_values('Created', ascending=False).head(5)
        st.dataframe(recent_incidents, use_container_width=True)
    
    def render_training_compliance(self, metrics: Dict[str, Any]):
        """Render training compliance section"""
        st.subheader("🎓 Training Compliance")
        
        # Generate training data
        training_courses = [
            'AI Ethics Fundamentals',
            'Bias Detection & Mitigation',
            'Privacy & Data Protection',
            'Security Best Practices',
            'Incident Response'
        ]
        
        training_data = []
        for course in training_courses:
            training_data.append({
                'Course': course,
                'Completion Rate': np.random.uniform(80, 98),
                'Due Date': datetime.now() + timedelta(days=np.random.randint(30, 180)),
                'Enrolled': np.random.randint(45, 85),
                'Completed': np.random.randint(35, 80)
            })
        
        training_df = pd.DataFrame(training_data)
        
        col1, col2 = st.columns(2)
        
        with col1:
            # Training completion rates
            fig_training = px.bar(
                training_df,
                x='Course',
                y='Completion Rate',
                title="Training Completion Rates",
                color='Completion Rate',
                color_continuous_scale='RdYlGn'
            )
            fig_training.update_xaxis(tickangle=45)
            st.plotly_chart(fig_training, use_container_width=True)
        
        with col2:
            # Overall training metrics
            total_enrolled = training_df['Enrolled'].sum()
            total_completed = training_df['Completed'].sum()
            overall_rate = (total_completed / total_enrolled) * 100
            
            st.metric(
                label="Overall Training Completion",
                value=f"{overall_rate:.1f}%",
                delta=f"{np.random.uniform(-2, 3):.1f}%"
            )
            
            st.metric(
                label="Total Employees Enrolled",
                value=str(total_enrolled),
                delta=str(np.random.randint(-5, 10))
            )
            
            st.metric(
                label="Certificates Issued",
                value=str(total_completed),
                delta=str(np.random.randint(-3, 8))
            )
    
    def render_alerts_notifications(self):
        """Render alerts and notifications section"""
        st.subheader("🔔 Active Alerts")
        
        # Generate sample alerts
        alerts = [
            {
                'Type': 'High',
                'Message': 'Model drift detected in Recommendations Engine',
                'Time': '2 hours ago',
                'Action': 'Retrain model scheduled'
            },
            {
                'Type': 'Medium',
                'Message': 'DPIA pending approval for new AI feature',
                'Time': '1 day ago',
                'Action': 'Awaiting DPO review'
            },
            {
                'Type': 'Low',
                'Message': 'Training completion reminder sent',
                'Time': '3 days ago',
                'Action': 'Follow-up scheduled'
            }
        ]
        
        for alert in alerts:
            alert_class = f"alert-{alert['Type'].lower()}"
            st.markdown(f"""
            <div class="metric-card {alert_class}">
                <strong>{alert['Type']} Priority:</strong> {alert['Message']}<br>
                <small>⏰ {alert['Time']} | 🔧 {alert['Action']}</small>
            </div>
            """, unsafe_allow_html=True)
            st.markdown("<br>", unsafe_allow_html=True)
    
    def render_sidebar_controls(self):
        """Render sidebar controls"""
        st.sidebar.header("Dashboard Controls")
        
        # Refresh button
        if st.sidebar.button("🔄 Refresh Data"):
            st.experimental_rerun()
        
        # Time range selector
        time_range = st.sidebar.selectbox(
            "Time Range",
            ["Last 24 hours", "Last 7 days", "Last 30 days", "Last 90 days"]
        )
        
        # Filter options
        st.sidebar.header("Filters")
        
        show_incidents = st.sidebar.checkbox("Show Incidents", True)
        show_bias_monitoring = st.sidebar.checkbox("Bias Monitoring", True)
        show_training = st.sidebar.checkbox("Training Compliance", True)
        
        # Export options
        st.sidebar.header("Export")
        if st.sidebar.button("📊 Export Report"):
            st.sidebar.success("Report exported successfully!")
        
        return {
            'time_range': time_range,
            'show_incidents': show_incidents,
            'show_bias_monitoring': show_bias_monitoring,
            'show_training': show_training
        }
    
    def run(self):
        """Main dashboard execution"""
        # Render header
        self.render_header()
        
        # Render sidebar controls
        controls = self.render_sidebar_controls()
        
        # Fetch current metrics
        metrics = self.fetch_governance_metrics()
        
        # Display last updated time
        st.caption(f"Last updated: {metrics['last_updated'].strftime('%Y-%m-%d %H:%M:%S')}")
        
        # Render KPI cards
        self.render_kpi_cards(metrics)
        
        st.markdown("---")
        
        # Render main sections
        self.render_compliance_overview(metrics)
        
        if controls['show_bias_monitoring']:
            st.markdown("---")
            self.render_bias_monitoring()
        
        st.markdown("---")
        self.render_model_performance()
        
        if controls['show_incidents']:
            st.markdown("---")
            self.render_incident_tracking(metrics)
        
        if controls['show_training']:
            st.markdown("---")
            self.render_training_compliance(metrics)
        
        st.markdown("---")
        self.render_alerts_notifications()
        
        # Footer
        st.markdown("---")
        st.markdown("""
        <div style="text-align: center; color: #666;">
            <p>AeroFusionXR AI Governance Dashboard | 
            <a href="mailto:ai-governance@aerofusionxr.com">Contact Support</a></p>
        </div>
        """, unsafe_allow_html=True)

def main():
    """Main application entry point"""
    dashboard = GovernanceDashboard()
    dashboard.run()

if __name__ == "__main__":
    main()