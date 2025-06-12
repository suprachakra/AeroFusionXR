#!/usr/bin/env python3
"""
Automated Compliance Reporting System
Generates comprehensive compliance reports for GDPR, PDPL, EU AI Act, and other regulations
"""

import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Tuple
import json
import logging
from pathlib import Path
import jinja2
from dataclasses import dataclass, asdict
import matplotlib.pyplot as plt
import seaborn as sns
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter, A4
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.base import MIMEBase
from email import encoders
import requests
import sqlite3
from contextlib import contextmanager

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@dataclass
class ComplianceMetric:
    """Data class for compliance metrics"""
    metric_name: str
    current_value: float
    target_value: float
    compliance_status: str  # 'compliant', 'non_compliant', 'at_risk'
    last_updated: datetime
    regulation: str
    description: str
    remediation_required: bool = False

@dataclass
class ComplianceIncident:
    """Data class for compliance incidents"""
    incident_id: str
    incident_type: str
    severity: str
    regulation: str
    description: str
    detected_date: datetime
    resolved_date: Optional[datetime]
    status: str
    remediation_actions: List[str]
    responsible_team: str

@dataclass
class DataProcessingActivity:
    """Data class for GDPR data processing activities"""
    activity_id: str
    activity_name: str
    data_controller: str
    data_processor: str
    purpose: str
    legal_basis: str
    data_categories: List[str]
    data_subjects: List[str]
    retention_period: str
    security_measures: List[str]
    third_country_transfers: bool
    dpia_required: bool
    dpia_completed: bool
    last_reviewed: datetime

class ComplianceDatabase:
    """Database interface for compliance data"""
    
    def __init__(self, db_path: str = "governance/data/compliance.db"):
        self.db_path = db_path
        self.init_database()
    
    @contextmanager
    def get_connection(self):
        """Get database connection with context manager"""
        conn = sqlite3.connect(self.db_path)
        try:
            yield conn
        finally:
            conn.close()
    
    def init_database(self):
        """Initialize database tables"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            
            # Compliance metrics table
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS compliance_metrics (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    metric_name TEXT NOT NULL,
                    current_value REAL NOT NULL,
                    target_value REAL NOT NULL,
                    compliance_status TEXT NOT NULL,
                    last_updated TIMESTAMP NOT NULL,
                    regulation TEXT NOT NULL,
                    description TEXT,
                    remediation_required BOOLEAN DEFAULT FALSE
                )
            ''')
            
            # Compliance incidents table
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS compliance_incidents (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    incident_id TEXT UNIQUE NOT NULL,
                    incident_type TEXT NOT NULL,
                    severity TEXT NOT NULL,
                    regulation TEXT NOT NULL,
                    description TEXT,
                    detected_date TIMESTAMP NOT NULL,
                    resolved_date TIMESTAMP,
                    status TEXT NOT NULL,
                    remediation_actions TEXT,
                    responsible_team TEXT
                )
            ''')
            
            # Data processing activities table
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS data_processing_activities (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    activity_id TEXT UNIQUE NOT NULL,
                    activity_name TEXT NOT NULL,
                    data_controller TEXT NOT NULL,
                    data_processor TEXT,
                    purpose TEXT NOT NULL,
                    legal_basis TEXT NOT NULL,
                    data_categories TEXT,
                    data_subjects TEXT,
                    retention_period TEXT,
                    security_measures TEXT,
                    third_country_transfers BOOLEAN DEFAULT FALSE,
                    dpia_required BOOLEAN DEFAULT FALSE,
                    dpia_completed BOOLEAN DEFAULT FALSE,
                    last_reviewed TIMESTAMP NOT NULL
                )
            ''')
            
            conn.commit()
    
    def insert_metric(self, metric: ComplianceMetric):
        """Insert compliance metric"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                INSERT OR REPLACE INTO compliance_metrics 
                (metric_name, current_value, target_value, compliance_status, 
                 last_updated, regulation, description, remediation_required)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                metric.metric_name, metric.current_value, metric.target_value,
                metric.compliance_status, metric.last_updated, metric.regulation,
                metric.description, metric.remediation_required
            ))
            conn.commit()
    
    def get_metrics_by_regulation(self, regulation: str) -> List[ComplianceMetric]:
        """Get compliance metrics for specific regulation"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT * FROM compliance_metrics WHERE regulation = ?
                ORDER BY last_updated DESC
            ''', (regulation,))
            
            metrics = []
            for row in cursor.fetchall():
                metrics.append(ComplianceMetric(
                    metric_name=row[1],
                    current_value=row[2],
                    target_value=row[3],
                    compliance_status=row[4],
                    last_updated=datetime.fromisoformat(row[5]),
                    regulation=row[6],
                    description=row[7],
                    remediation_required=bool(row[8])
                ))
            
            return metrics

class GDPRReporter:
    """GDPR compliance reporting"""
    
    def __init__(self, db: ComplianceDatabase):
        self.db = db
        self.regulation = "GDPR"
    
    def generate_article_30_record(self) -> Dict[str, Any]:
        """Generate Article 30 Record of Processing Activities"""
        
        # Sample data - in production, this would come from actual systems
        processing_activities = [
            DataProcessingActivity(
                activity_id="DPA-001",
                activity_name="Customer Data Processing",
                data_controller="AeroFusionXR Ltd",
                data_processor="Internal",
                purpose="Provide aviation services and customer support",
                legal_basis="Contract performance (Art. 6(1)(b))",
                data_categories=["Personal identifiers", "Contact details", "Flight preferences"],
                data_subjects=["Customers", "Prospects"],
                retention_period="7 years after contract termination",
                security_measures=["Encryption", "Access controls", "Regular backups"],
                third_country_transfers=False,
                dpia_required=False,
                dpia_completed=True,
                last_reviewed=datetime.now() - timedelta(days=30)
            ),
            DataProcessingActivity(
                activity_id="DPA-002",
                activity_name="AI Model Training",
                data_controller="AeroFusionXR Ltd",
                data_processor="Cloud Provider",
                purpose="Train and improve AI models for service optimization",
                legal_basis="Legitimate interest (Art. 6(1)(f))",
                data_categories=["Usage patterns", "Behavioral data", "Performance metrics"],
                data_subjects=["Users", "Customers"],
                retention_period="3 years",
                security_measures=["Pseudonymization", "Encryption", "Access logging"],
                third_country_transfers=True,
                dpia_required=True,
                dpia_completed=True,
                last_reviewed=datetime.now() - timedelta(days=15)
            )
        ]
        
        return {
            "organization": "AeroFusionXR Ltd",
            "dpo_contact": "dpo@aerofusionxr.com",
            "report_date": datetime.now(),
            "processing_activities": [asdict(activity) for activity in processing_activities],
            "total_activities": len(processing_activities),
            "high_risk_activities": sum(1 for a in processing_activities if a.dpia_required),
            "dpia_completion_rate": sum(1 for a in processing_activities if a.dpia_completed) / len(processing_activities) * 100
        }
    
    def assess_data_subject_rights(self) -> Dict[str, Any]:
        """Assess data subject rights compliance"""
        
        # Sample metrics - in production, fetch from actual systems
        rights_metrics = {
            "access_requests": {
                "total_received": 45,
                "processed_within_30_days": 43,
                "compliance_rate": 95.6,
                "average_response_time": 18.5
            },
            "rectification_requests": {
                "total_received": 12,
                "processed_within_30_days": 12,
                "compliance_rate": 100.0,
                "average_response_time": 8.2
            },
            "erasure_requests": {
                "total_received": 8,
                "processed_within_30_days": 7,
                "compliance_rate": 87.5,
                "average_response_time": 22.1
            },
            "portability_requests": {
                "total_received": 3,
                "processed_within_30_days": 3,
                "compliance_rate": 100.0,
                "average_response_time": 15.0
            }
        }
        
        overall_compliance = sum(
            metrics["compliance_rate"] for metrics in rights_metrics.values()
        ) / len(rights_metrics)
        
        return {
            "assessment_date": datetime.now(),
            "overall_compliance_rate": overall_compliance,
            "rights_breakdown": rights_metrics,
            "non_compliant_cases": sum(
                metrics["total_received"] - int(metrics["total_received"] * metrics["compliance_rate"] / 100)
                for metrics in rights_metrics.values()
            ),
            "recommendations": [
                "Implement automated response system for access requests",
                "Improve data location tracking for erasure requests",
                "Regular training on data subject rights procedures"
            ]
        }
    
    def generate_breach_report(self) -> Dict[str, Any]:
        """Generate data breach compliance report"""
        
        # Sample breach data
        breaches = [
            {
                "breach_id": "BR-2024-001",
                "detection_date": datetime.now() - timedelta(days=45),
                "notification_date": datetime.now() - timedelta(days=44),
                "authority_notified": True,
                "subjects_notified": False,
                "severity": "Medium",
                "affected_subjects": 150,
                "data_categories": ["Email addresses", "Names"],
                "cause": "Misconfigured database access",
                "remediation_completed": True
            },
            {
                "breach_id": "BR-2024-002",
                "detection_date": datetime.now() - timedelta(days=20),
                "notification_date": datetime.now() - timedelta(days=19),
                "authority_notified": True,
                "subjects_notified": True,
                "severity": "High",
                "affected_subjects": 1200,
                "data_categories": ["Personal identifiers", "Financial data"],
                "cause": "Phishing attack",
                "remediation_completed": True
            }
        ]
        
        return {
            "reporting_period": "Last 12 months",
            "total_breaches": len(breaches),
            "high_severity_breaches": sum(1 for b in breaches if b["severity"] == "High"),
            "authority_notification_compliance": sum(1 for b in breaches if b["authority_notified"]) / len(breaches) * 100,
            "subject_notification_compliance": sum(1 for b in breaches if b["subjects_notified"]) / len(breaches) * 100,
            "average_detection_to_notification": 1.2,  # days
            "breaches": breaches,
            "remediation_status": "All breaches remediated"
        }

class PDPLReporter:
    """UAE PDPL compliance reporting"""
    
    def __init__(self, db: ComplianceDatabase):
        self.db = db
        self.regulation = "PDPL"
    
    def generate_compliance_report(self) -> Dict[str, Any]:
        """Generate PDPL compliance report"""
        
        return {
            "report_date": datetime.now(),
            "organization": "AeroFusionXR UAE",
            "data_residency_compliance": {
                "uae_data_stored_locally": True,
                "cross_border_transfers": {
                    "total_transfers": 5,
                    "adequate_safeguards": 5,
                    "compliance_rate": 100.0
                }
            },
            "consent_management": {
                "explicit_consent_rate": 98.5,
                "consent_withdrawal_mechanism": True,
                "consent_records_maintained": True
            },
            "data_protection_officer": {
                "appointed": True,
                "local_presence": True,
                "contact_published": True
            },
            "privacy_impact_assessments": {
                "high_risk_processing_identified": 3,
                "pias_completed": 3,
                "completion_rate": 100.0
            },
            "data_subject_rights": {
                "access_mechanism": True,
                "correction_mechanism": True,
                "deletion_mechanism": True,
                "average_response_time": 15.2  # days
            }
        }

class EUAIActReporter:
    """EU AI Act compliance reporting"""
    
    def __init__(self, db: ComplianceDatabase):
        self.db = db
        self.regulation = "EU_AI_Act"
    
    def classify_ai_systems(self) -> Dict[str, Any]:
        """Classify AI systems according to EU AI Act risk categories"""
        
        ai_systems = [
            {
                "system_name": "AI Concierge",
                "risk_category": "Limited Risk",
                "use_case": "Customer service automation",
                "transparency_obligations": True,
                "human_oversight": True,
                "conformity_assessment": False
            },
            {
                "system_name": "Predictive Maintenance",
                "risk_category": "High Risk",
                "use_case": "Safety-critical aviation maintenance",
                "transparency_obligations": True,
                "human_oversight": True,
                "conformity_assessment": True
            },
            {
                "system_name": "Recommendations Engine",
                "risk_category": "Limited Risk",
                "use_case": "Service recommendations",
                "transparency_obligations": True,
                "human_oversight": True,
                "conformity_assessment": False
            }
        ]
        
        return {
            "classification_date": datetime.now(),
            "total_systems": len(ai_systems),
            "high_risk_systems": sum(1 for s in ai_systems if s["risk_category"] == "High Risk"),
            "limited_risk_systems": sum(1 for s in ai_systems if s["risk_category"] == "Limited Risk"),
            "systems_detail": ai_systems,
            "compliance_requirements": {
                "risk_management_system": True,
                "data_governance": True,
                "transparency_documentation": True,
                "human_oversight": True,
                "accuracy_robustness": True,
                "cybersecurity": True
            }
        }
    
    def generate_conformity_assessment(self) -> Dict[str, Any]:
        """Generate conformity assessment for high-risk AI systems"""
        
        return {
            "assessment_date": datetime.now(),
            "high_risk_systems": [
                {
                    "system_name": "Predictive Maintenance",
                    "conformity_assessment_completed": True,
                    "ce_marking": True,
                    "declaration_of_conformity": True,
                    "technical_documentation": True,
                    "quality_management_system": True,
                    "post_market_monitoring": True,
                    "notified_body": "TÜV SÜD",
                    "certificate_number": "AI-CERT-2024-001",
                    "validity_period": "2024-2027"
                }
            ],
            "overall_compliance": True,
            "next_review_date": datetime.now() + timedelta(days=365)
        }

class ComplianceReporter:
    """Main compliance reporting system"""
    
    def __init__(self, config_path: str = "governance/config/compliance_config.json"):
        self.config = self.load_config(config_path)
        self.db = ComplianceDatabase()
        
        # Initialize regulation-specific reporters
        self.gdpr_reporter = GDPRReporter(self.db)
        self.pdpl_reporter = PDPLReporter(self.db)
        self.eu_ai_act_reporter = EUAIActReporter(self.db)
        
        # Setup Jinja2 for report templates
        self.template_env = jinja2.Environment(
            loader=jinja2.FileSystemLoader('governance/templates')
        )
    
    def load_config(self, config_path: str) -> Dict[str, Any]:
        """Load configuration"""
        try:
            with open(config_path, 'r') as f:
                return json.load(f)
        except Exception as e:
            logger.warning(f"Failed to load config: {e}")
            return self.get_default_config()
    
    def get_default_config(self) -> Dict[str, Any]:
        """Get default configuration"""
        return {
            "reporting": {
                "output_directory": "governance/reports",
                "email_notifications": True,
                "dashboard_integration": True
            },
            "regulations": {
                "gdpr": {"enabled": True, "frequency": "monthly"},
                "pdpl": {"enabled": True, "frequency": "quarterly"},
                "eu_ai_act": {"enabled": True, "frequency": "quarterly"},
                "iso_42001": {"enabled": True, "frequency": "annual"}
            },
            "stakeholders": {
                "dpo": "dpo@aerofusionxr.com",
                "compliance_team": "compliance@aerofusionxr.com",
                "ai_ethics_board": "ai-ethics@aerofusionxr.com",
                "executive_team": "executives@aerofusionxr.com"
            }
        }
    
    def generate_comprehensive_report(self, regulation: str = "all") -> Dict[str, Any]:
        """Generate comprehensive compliance report"""
        
        report_data = {
            "report_metadata": {
                "generated_date": datetime.now(),
                "report_type": "Comprehensive Compliance Report",
                "regulation_scope": regulation,
                "reporting_period": "Last 12 months",
                "organization": "AeroFusionXR"
            },
            "executive_summary": {},
            "detailed_findings": {},
            "recommendations": [],
            "action_items": []
        }
        
        if regulation == "all" or regulation == "gdpr":
            # GDPR reporting
            gdpr_data = {
                "article_30_record": self.gdpr_reporter.generate_article_30_record(),
                "data_subject_rights": self.gdpr_reporter.assess_data_subject_rights(),
                "breach_report": self.gdpr_reporter.generate_breach_report()
            }
            report_data["detailed_findings"]["gdpr"] = gdpr_data
            
            # GDPR executive summary
            report_data["executive_summary"]["gdpr"] = {
                "overall_compliance": "Compliant",
                "key_metrics": {
                    "dpia_completion_rate": gdpr_data["article_30_record"]["dpia_completion_rate"],
                    "data_subject_rights_compliance": gdpr_data["data_subject_rights"]["overall_compliance_rate"],
                    "breach_notification_compliance": gdpr_data["breach_report"]["authority_notification_compliance"]
                },
                "risk_level": "Low"
            }
        
        if regulation == "all" or regulation == "pdpl":
            # PDPL reporting
            pdpl_data = self.pdpl_reporter.generate_compliance_report()
            report_data["detailed_findings"]["pdpl"] = pdpl_data
            
            # PDPL executive summary
            report_data["executive_summary"]["pdpl"] = {
                "overall_compliance": "Compliant",
                "key_metrics": {
                    "data_residency_compliance": pdpl_data["data_residency_compliance"]["cross_border_transfers"]["compliance_rate"],
                    "consent_management": pdpl_data["consent_management"]["explicit_consent_rate"],
                    "pia_completion_rate": pdpl_data["privacy_impact_assessments"]["completion_rate"]
                },
                "risk_level": "Low"
            }
        
        if regulation == "all" or regulation == "eu_ai_act":
            # EU AI Act reporting
            ai_classification = self.eu_ai_act_reporter.classify_ai_systems()
            conformity_assessment = self.eu_ai_act_reporter.generate_conformity_assessment()
            
            eu_ai_act_data = {
                "system_classification": ai_classification,
                "conformity_assessment": conformity_assessment
            }
            report_data["detailed_findings"]["eu_ai_act"] = eu_ai_act_data
            
            # EU AI Act executive summary
            report_data["executive_summary"]["eu_ai_act"] = {
                "overall_compliance": "Compliant",
                "key_metrics": {
                    "high_risk_systems": ai_classification["high_risk_systems"],
                    "conformity_assessments_completed": len(conformity_assessment["high_risk_systems"]),
                    "ce_marking_compliance": 100.0
                },
                "risk_level": "Medium"
            }
        
        # Generate overall recommendations
        report_data["recommendations"] = self.generate_recommendations(report_data)
        report_data["action_items"] = self.generate_action_items(report_data)
        
        return report_data
    
    def generate_recommendations(self, report_data: Dict[str, Any]) -> List[str]:
        """Generate actionable recommendations"""
        recommendations = []
        
        # GDPR recommendations
        if "gdpr" in report_data["detailed_findings"]:
            gdpr_data = report_data["detailed_findings"]["gdpr"]
            if gdpr_data["data_subject_rights"]["overall_compliance_rate"] < 95:
                recommendations.append("Improve data subject rights response procedures to achieve >95% compliance")
            
            if gdpr_data["breach_report"]["subject_notification_compliance"] < 100:
                recommendations.append("Enhance breach notification procedures for data subjects")
        
        # PDPL recommendations
        if "pdpl" in report_data["detailed_findings"]:
            pdpl_data = report_data["detailed_findings"]["pdpl"]
            if pdpl_data["consent_management"]["explicit_consent_rate"] < 99:
                recommendations.append("Optimize consent collection mechanisms to achieve >99% explicit consent rate")
        
        # EU AI Act recommendations
        if "eu_ai_act" in report_data["detailed_findings"]:
            ai_data = report_data["detailed_findings"]["eu_ai_act"]
            if ai_data["system_classification"]["high_risk_systems"] > 0:
                recommendations.append("Implement continuous monitoring for high-risk AI systems")
                recommendations.append("Establish regular conformity assessment review schedule")
        
        # General recommendations
        recommendations.extend([
            "Conduct quarterly compliance training for all staff",
            "Implement automated compliance monitoring dashboard",
            "Establish regular third-party compliance audits",
            "Enhance documentation and record-keeping procedures"
        ])
        
        return recommendations
    
    def generate_action_items(self, report_data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Generate specific action items with owners and deadlines"""
        action_items = []
        
        # High priority items
        action_items.extend([
            {
                "priority": "High",
                "action": "Complete DPIA for new AI features",
                "owner": "Data Protection Officer",
                "deadline": (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d"),
                "regulation": "GDPR"
            },
            {
                "priority": "High",
                "action": "Update privacy notices for AI processing",
                "owner": "Legal Team",
                "deadline": (datetime.now() + timedelta(days=45)).strftime("%Y-%m-%d"),
                "regulation": "GDPR/PDPL"
            }
        ])
        
        # Medium priority items
        action_items.extend([
            {
                "priority": "Medium",
                "action": "Implement automated bias testing in CI/CD",
                "owner": "AI Engineering Team",
                "deadline": (datetime.now() + timedelta(days=60)).strftime("%Y-%m-%d"),
                "regulation": "EU AI Act"
            },
            {
                "priority": "Medium",
                "action": "Conduct compliance training for development teams",
                "owner": "HR/Compliance",
                "deadline": (datetime.now() + timedelta(days=90)).strftime("%Y-%m-%d"),
                "regulation": "All"
            }
        ])
        
        return action_items
    
    def generate_pdf_report(self, report_data: Dict[str, Any], output_path: str):
        """Generate PDF compliance report"""
        doc = SimpleDocTemplate(output_path, pagesize=A4)
        styles = getSampleStyleSheet()
        story = []
        
        # Title
        title_style = ParagraphStyle(
            'CustomTitle',
            parent=styles['Heading1'],
            fontSize=24,
            spaceAfter=30,
            alignment=1  # Center alignment
        )
        story.append(Paragraph("AI Governance Compliance Report", title_style))
        story.append(Spacer(1, 20))
        
        # Metadata
        metadata = report_data["report_metadata"]
        story.append(Paragraph(f"<b>Organization:</b> {metadata['organization']}", styles['Normal']))
        story.append(Paragraph(f"<b>Report Date:</b> {metadata['generated_date'].strftime('%Y-%m-%d')}", styles['Normal']))
        story.append(Paragraph(f"<b>Reporting Period:</b> {metadata['reporting_period']}", styles['Normal']))
        story.append(Spacer(1, 20))
        
        # Executive Summary
        story.append(Paragraph("Executive Summary", styles['Heading2']))
        for regulation, summary in report_data["executive_summary"].items():
            story.append(Paragraph(f"<b>{regulation.upper()}:</b> {summary['overall_compliance']} (Risk: {summary['risk_level']})", styles['Normal']))
        story.append(Spacer(1, 20))
        
        # Recommendations
        story.append(Paragraph("Key Recommendations", styles['Heading2']))
        for i, rec in enumerate(report_data["recommendations"][:5], 1):
            story.append(Paragraph(f"{i}. {rec}", styles['Normal']))
        story.append(Spacer(1, 20))
        
        # Action Items Table
        story.append(Paragraph("Priority Action Items", styles['Heading2']))
        action_data = [["Priority", "Action", "Owner", "Deadline"]]
        for item in report_data["action_items"][:10]:
            action_data.append([
                item["priority"],
                item["action"][:50] + "..." if len(item["action"]) > 50 else item["action"],
                item["owner"],
                item["deadline"]
            ])
        
        action_table = Table(action_data)
        action_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 12),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
            ('GRID', (0, 0), (-1, -1), 1, colors.black)
        ]))
        story.append(action_table)
        
        # Build PDF
        doc.build(story)
        logger.info(f"PDF report generated: {output_path}")
    
    def generate_html_report(self, report_data: Dict[str, Any], output_path: str):
        """Generate HTML compliance report"""
        try:
            template = self.template_env.get_template('compliance_report.html')
            html_content = template.render(report_data=report_data)
            
            with open(output_path, 'w', encoding='utf-8') as f:
                f.write(html_content)
            
            logger.info(f"HTML report generated: {output_path}")
        except Exception as e:
            logger.error(f"Failed to generate HTML report: {e}")
    
    def send_report_notifications(self, report_data: Dict[str, Any], report_paths: List[str]):
        """Send report notifications to stakeholders"""
        try:
            # Email configuration (would be loaded from secure config)
            smtp_server = self.config.get('email', {}).get('smtp_server', 'smtp.gmail.com')
            smtp_port = self.config.get('email', {}).get('smtp_port', 587)
            sender_email = self.config.get('email', {}).get('sender_email')
            sender_password = self.config.get('email', {}).get('sender_password')
            
            if not sender_email or not sender_password:
                logger.warning("Email configuration not found, skipping notifications")
                return
            
            # Create message
            msg = MIMEMultipart()
            msg['From'] = sender_email
            msg['Subject'] = f"AI Governance Compliance Report - {datetime.now().strftime('%Y-%m-%d')}"
            
            # Email body
            body = f"""
            Dear Stakeholder,
            
            Please find attached the latest AI Governance Compliance Report.
            
            Executive Summary:
            """
            
            for regulation, summary in report_data["executive_summary"].items():
                body += f"\n- {regulation.upper()}: {summary['overall_compliance']} (Risk: {summary['risk_level']})"
            
            body += f"""
            
            Total Recommendations: {len(report_data["recommendations"])}
            Priority Action Items: {len([item for item in report_data["action_items"] if item["priority"] == "High"])}
            
            Please review the detailed report and take necessary actions.
            
            Best regards,
            AI Governance Team
            """
            
            msg.attach(MIMEText(body, 'plain'))
            
            # Attach reports
            for report_path in report_paths:
                with open(report_path, "rb") as attachment:
                    part = MIMEBase('application', 'octet-stream')
                    part.set_payload(attachment.read())
                    encoders.encode_base64(part)
                    part.add_header(
                        'Content-Disposition',
                        f'attachment; filename= {Path(report_path).name}'
                    )
                    msg.attach(part)
            
            # Send emails to stakeholders
            stakeholders = self.config.get('stakeholders', {})
            recipients = [email for email in stakeholders.values() if email]
            
            if recipients:
                msg['To'] = ', '.join(recipients)
                
                server = smtplib.SMTP(smtp_server, smtp_port)
                server.starttls()
                server.login(sender_email, sender_password)
                server.send_message(msg)
                server.quit()
                
                logger.info(f"Report notifications sent to {len(recipients)} stakeholders")
            
        except Exception as e:
            logger.error(f"Failed to send report notifications: {e}")
    
    def run_scheduled_reporting(self):
        """Run scheduled compliance reporting"""
        logger.info("Starting scheduled compliance reporting")
        
        # Determine which reports to generate based on schedule
        current_date = datetime.now()
        reports_to_generate = []
        
        for regulation, config in self.config["regulations"].items():
            if not config.get("enabled", False):
                continue
            
            frequency = config.get("frequency", "monthly")
            
            # Simple scheduling logic (in production, use proper scheduler)
            if frequency == "monthly" or (frequency == "quarterly" and current_date.month % 3 == 1) or (frequency == "annual" and current_date.month == 1):
                reports_to_generate.append(regulation)
        
        if not reports_to_generate:
            logger.info("No reports scheduled for generation")
            return
        
        # Generate reports
        output_dir = Path(self.config["reporting"]["output_directory"])
        output_dir.mkdir(parents=True, exist_ok=True)
        
        for regulation in reports_to_generate:
            try:
                logger.info(f"Generating {regulation} compliance report")
                
                # Generate report data
                report_data = self.generate_comprehensive_report(regulation)
                
                # Generate output files
                timestamp = current_date.strftime("%Y%m%d_%H%M%S")
                pdf_path = output_dir / f"compliance_report_{regulation}_{timestamp}.pdf"
                html_path = output_dir / f"compliance_report_{regulation}_{timestamp}.html"
                json_path = output_dir / f"compliance_report_{regulation}_{timestamp}.json"
                
                # Generate PDF report
                self.generate_pdf_report(report_data, str(pdf_path))
                
                # Generate HTML report
                self.generate_html_report(report_data, str(html_path))
                
                # Save JSON data
                with open(json_path, 'w') as f:
                    json.dump(report_data, f, indent=2, default=str)
                
                # Send notifications
                if self.config["reporting"].get("email_notifications", False):
                    self.send_report_notifications(report_data, [str(pdf_path), str(html_path)])
                
                logger.info(f"Completed {regulation} compliance report generation")
                
            except Exception as e:
                logger.error(f"Failed to generate {regulation} report: {e}")

def main():
    """Main function for compliance reporting"""
    import argparse
    
    parser = argparse.ArgumentParser(description='AI Governance Compliance Reporter')
    parser.add_argument('--regulation', choices=['gdpr', 'pdpl', 'eu_ai_act', 'all'], 
                       default='all', help='Regulation to report on')
    parser.add_argument('--output-format', choices=['pdf', 'html', 'json', 'all'], 
                       default='all', help='Output format')
    parser.add_argument('--output-dir', default='governance/reports', 
                       help='Output directory')
    parser.add_argument('--schedule', action='store_true', 
                       help='Run scheduled reporting')
    
    args = parser.parse_args()
    
    # Initialize reporter
    reporter = ComplianceReporter()
    
    if args.schedule:
        reporter.run_scheduled_reporting()
    else:
        # Generate single report
        report_data = reporter.generate_comprehensive_report(args.regulation)
        
        # Create output directory
        output_dir = Path(args.output_dir)
        output_dir.mkdir(parents=True, exist_ok=True)
        
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        
        if args.output_format in ['pdf', 'all']:
            pdf_path = output_dir / f"compliance_report_{args.regulation}_{timestamp}.pdf"
            reporter.generate_pdf_report(report_data, str(pdf_path))
        
        if args.output_format in ['html', 'all']:
            html_path = output_dir / f"compliance_report_{args.regulation}_{timestamp}.html"
            reporter.generate_html_report(report_data, str(html_path))
        
        if args.output_format in ['json', 'all']:
            json_path = output_dir / f"compliance_report_{args.regulation}_{timestamp}.json"
            with open(json_path, 'w') as f:
                json.dump(report_data, f, indent=2, default=str)
        
        logger.info("Compliance report generation completed")

if __name__ == "__main__":
    main()