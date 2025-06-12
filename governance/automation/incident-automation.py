#!/usr/bin/env python3
"""
Automated Incident Response System
Handles governance violations, escalations, and remediation workflows
"""

import asyncio
import json
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Callable
from dataclasses import dataclass, asdict
from enum import Enum
import uuid
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
import requests
import sqlite3
from contextlib import contextmanager
from pathlib import Path
import jinja2
import yaml

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class IncidentSeverity(Enum):
    """Incident severity levels"""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"

class IncidentStatus(Enum):
    """Incident status values"""
    OPEN = "open"
    INVESTIGATING = "investigating"
    ESCALATED = "escalated"
    RESOLVING = "resolving"
    RESOLVED = "resolved"
    CLOSED = "closed"

class IncidentType(Enum):
    """Types of governance incidents"""
    BIAS_DETECTION = "bias_detection"
    PRIVACY_VIOLATION = "privacy_violation"
    SECURITY_BREACH = "security_breach"
    MODEL_DRIFT = "model_drift"
    COMPLIANCE_VIOLATION = "compliance_violation"
    POLICY_BREACH = "policy_breach"
    DATA_QUALITY = "data_quality"
    ETHICAL_CONCERN = "ethical_concern"

@dataclass
class Incident:
    """Data class for governance incidents"""
    incident_id: str
    incident_type: IncidentType
    severity: IncidentSeverity
    title: str
    description: str
    affected_system: str
    detected_by: str
    detection_time: datetime
    status: IncidentStatus
    assigned_to: Optional[str] = None
    escalated_to: Optional[str] = None
    resolution_time: Optional[datetime] = None
    remediation_actions: List[str] = None
    root_cause: Optional[str] = None
    lessons_learned: Optional[str] = None
    metadata: Dict[str, Any] = None

    def __post_init__(self):
        if self.remediation_actions is None:
            self.remediation_actions = []
        if self.metadata is None:
            self.metadata = {}

@dataclass
class EscalationRule:
    """Data class for escalation rules"""
    rule_id: str
    incident_type: IncidentType
    severity: IncidentSeverity
    time_threshold_minutes: int
    escalate_to: str
    notification_channels: List[str]
    auto_actions: List[str]

@dataclass
class RemediationAction:
    """Data class for remediation actions"""
    action_id: str
    incident_id: str
    action_type: str
    description: str
    assigned_to: str
    due_date: datetime
    status: str
    completion_date: Optional[datetime] = None
    notes: Optional[str] = None

class IncidentDatabase:
    """Database interface for incident management"""
    
    def __init__(self, db_path: str = "governance/data/incidents.db"):
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
            
            # Incidents table
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS incidents (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    incident_id TEXT UNIQUE NOT NULL,
                    incident_type TEXT NOT NULL,
                    severity TEXT NOT NULL,
                    title TEXT NOT NULL,
                    description TEXT,
                    affected_system TEXT,
                    detected_by TEXT,
                    detection_time TIMESTAMP NOT NULL,
                    status TEXT NOT NULL,
                    assigned_to TEXT,
                    escalated_to TEXT,
                    resolution_time TIMESTAMP,
                    remediation_actions TEXT,
                    root_cause TEXT,
                    lessons_learned TEXT,
                    metadata TEXT
                )
            ''')
            
            # Escalation rules table
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS escalation_rules (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    rule_id TEXT UNIQUE NOT NULL,
                    incident_type TEXT NOT NULL,
                    severity TEXT NOT NULL,
                    time_threshold_minutes INTEGER NOT NULL,
                    escalate_to TEXT NOT NULL,
                    notification_channels TEXT,
                    auto_actions TEXT
                )
            ''')
            
            # Remediation actions table
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS remediation_actions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    action_id TEXT UNIQUE NOT NULL,
                    incident_id TEXT NOT NULL,
                    action_type TEXT NOT NULL,
                    description TEXT,
                    assigned_to TEXT,
                    due_date TIMESTAMP,
                    status TEXT NOT NULL,
                    completion_date TIMESTAMP,
                    notes TEXT,
                    FOREIGN KEY (incident_id) REFERENCES incidents (incident_id)
                )
            ''')
            
            conn.commit()
    
    def insert_incident(self, incident: Incident):
        """Insert new incident"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                INSERT INTO incidents 
                (incident_id, incident_type, severity, title, description, affected_system,
                 detected_by, detection_time, status, assigned_to, escalated_to, 
                 resolution_time, remediation_actions, root_cause, lessons_learned, metadata)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                incident.incident_id, incident.incident_type.value, incident.severity.value,
                incident.title, incident.description, incident.affected_system,
                incident.detected_by, incident.detection_time, incident.status.value,
                incident.assigned_to, incident.escalated_to, incident.resolution_time,
                json.dumps(incident.remediation_actions), incident.root_cause,
                incident.lessons_learned, json.dumps(incident.metadata)
            ))
            conn.commit()
    
    def update_incident(self, incident: Incident):
        """Update existing incident"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                UPDATE incidents SET
                    status = ?, assigned_to = ?, escalated_to = ?, resolution_time = ?,
                    remediation_actions = ?, root_cause = ?, lessons_learned = ?, metadata = ?
                WHERE incident_id = ?
            ''', (
                incident.status.value, incident.assigned_to, incident.escalated_to,
                incident.resolution_time, json.dumps(incident.remediation_actions),
                incident.root_cause, incident.lessons_learned, json.dumps(incident.metadata),
                incident.incident_id
            ))
            conn.commit()
    
    def get_incident(self, incident_id: str) -> Optional[Incident]:
        """Get incident by ID"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM incidents WHERE incident_id = ?', (incident_id,))
            row = cursor.fetchone()
            
            if row:
                return Incident(
                    incident_id=row[1],
                    incident_type=IncidentType(row[2]),
                    severity=IncidentSeverity(row[3]),
                    title=row[4],
                    description=row[5],
                    affected_system=row[6],
                    detected_by=row[7],
                    detection_time=datetime.fromisoformat(row[8]),
                    status=IncidentStatus(row[9]),
                    assigned_to=row[10],
                    escalated_to=row[11],
                    resolution_time=datetime.fromisoformat(row[12]) if row[12] else None,
                    remediation_actions=json.loads(row[13]) if row[13] else [],
                    root_cause=row[14],
                    lessons_learned=row[15],
                    metadata=json.loads(row[16]) if row[16] else {}
                )
            return None
    
    def get_open_incidents(self) -> List[Incident]:
        """Get all open incidents"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT * FROM incidents 
                WHERE status IN ('open', 'investigating', 'escalated', 'resolving')
                ORDER BY detection_time DESC
            ''')
            
            incidents = []
            for row in cursor.fetchall():
                incidents.append(Incident(
                    incident_id=row[1],
                    incident_type=IncidentType(row[2]),
                    severity=IncidentSeverity(row[3]),
                    title=row[4],
                    description=row[5],
                    affected_system=row[6],
                    detected_by=row[7],
                    detection_time=datetime.fromisoformat(row[8]),
                    status=IncidentStatus(row[9]),
                    assigned_to=row[10],
                    escalated_to=row[11],
                    resolution_time=datetime.fromisoformat(row[12]) if row[12] else None,
                    remediation_actions=json.loads(row[13]) if row[13] else [],
                    root_cause=row[14],
                    lessons_learned=row[15],
                    metadata=json.loads(row[16]) if row[16] else {}
                ))
            
            return incidents

class NotificationService:
    """Service for sending notifications"""
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.template_env = jinja2.Environment(
            loader=jinja2.FileSystemLoader('governance/templates')
        )
    
    async def send_email(self, to_addresses: List[str], subject: str, 
                        body: str, incident: Optional[Incident] = None):
        """Send email notification"""
        try:
            # Email configuration
            smtp_server = self.config.get('email', {}).get('smtp_server', 'smtp.gmail.com')
            smtp_port = self.config.get('email', {}).get('smtp_port', 587)
            sender_email = self.config.get('email', {}).get('sender_email')
            sender_password = self.config.get('email', {}).get('sender_password')
            
            if not sender_email or not sender_password:
                logger.warning("Email configuration not found")
                return
            
            msg = MIMEMultipart()
            msg['From'] = sender_email
            msg['To'] = ', '.join(to_addresses)
            msg['Subject'] = subject
            
            # Use template if incident provided
            if incident:
                try:
                    template = self.template_env.get_template('incident_notification.html')
                    html_body = template.render(incident=incident)
                    msg.attach(MIMEText(html_body, 'html'))
                except Exception as e:
                    logger.warning(f"Failed to use template: {e}")
                    msg.attach(MIMEText(body, 'plain'))
            else:
                msg.attach(MIMEText(body, 'plain'))
            
            # Send email
            server = smtplib.SMTP(smtp_server, smtp_port)
            server.starttls()
            server.login(sender_email, sender_password)
            server.send_message(msg)
            server.quit()
            
            logger.info(f"Email sent to {len(to_addresses)} recipients")
            
        except Exception as e:
            logger.error(f"Failed to send email: {e}")
    
    async def send_slack_notification(self, channel: str, message: str, 
                                    incident: Optional[Incident] = None):
        """Send Slack notification"""
        try:
            webhook_url = self.config.get('slack', {}).get('webhook_url')
            if not webhook_url:
                logger.warning("Slack webhook URL not configured")
                return
            
            # Create Slack message
            slack_message = {
                "channel": channel,
                "text": message,
                "username": "AI Governance Bot",
                "icon_emoji": ":warning:"
            }
            
            if incident:
                # Add rich formatting for incident
                color = {
                    IncidentSeverity.LOW: "good",
                    IncidentSeverity.MEDIUM: "warning", 
                    IncidentSeverity.HIGH: "danger",
                    IncidentSeverity.CRITICAL: "danger"
                }.get(incident.severity, "warning")
                
                attachment = {
                    "color": color,
                    "title": f"Incident {incident.incident_id}",
                    "text": incident.description,
                    "fields": [
                        {"title": "Severity", "value": incident.severity.value.upper(), "short": True},
                        {"title": "Type", "value": incident.incident_type.value.replace('_', ' ').title(), "short": True},
                        {"title": "System", "value": incident.affected_system, "short": True},
                        {"title": "Status", "value": incident.status.value.upper(), "short": True}
                    ],
                    "footer": "AI Governance System",
                    "ts": int(incident.detection_time.timestamp())
                }
                slack_message["attachments"] = [attachment]
            
            # Send to Slack
            response = requests.post(webhook_url, json=slack_message, timeout=10)
            response.raise_for_status()
            
            logger.info(f"Slack notification sent to {channel}")
            
        except Exception as e:
            logger.error(f"Failed to send Slack notification: {e}")
    
    async def send_teams_notification(self, webhook_url: str, message: str,
                                    incident: Optional[Incident] = None):
        """Send Microsoft Teams notification"""
        try:
            teams_message = {
                "@type": "MessageCard",
                "@context": "http://schema.org/extensions",
                "themeColor": "FF0000" if incident and incident.severity in [IncidentSeverity.HIGH, IncidentSeverity.CRITICAL] else "FFA500",
                "summary": message,
                "sections": [{
                    "activityTitle": "AI Governance Alert",
                    "activitySubtitle": message,
                    "facts": []
                }]
            }
            
            if incident:
                teams_message["sections"][0]["facts"] = [
                    {"name": "Incident ID", "value": incident.incident_id},
                    {"name": "Severity", "value": incident.severity.value.upper()},
                    {"name": "Type", "value": incident.incident_type.value.replace('_', ' ').title()},
                    {"name": "System", "value": incident.affected_system},
                    {"name": "Status", "value": incident.status.value.upper()}
                ]
            
            response = requests.post(webhook_url, json=teams_message, timeout=10)
            response.raise_for_status()
            
            logger.info("Teams notification sent")
            
        except Exception as e:
            logger.error(f"Failed to send Teams notification: {e}")

class AutomatedActions:
    """Automated remediation actions"""
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config
    
    async def disable_model(self, model_name: str, incident: Incident) -> bool:
        """Disable a model in production"""
        try:
            # In production, this would call actual model management APIs
            logger.info(f"Disabling model {model_name} due to incident {incident.incident_id}")
            
            # Simulate API call
            api_url = self.config.get('model_management', {}).get('api_url')
            if api_url:
                response = requests.post(
                    f"{api_url}/models/{model_name}/disable",
                    json={"reason": f"Incident {incident.incident_id}"},
                    timeout=30
                )
                response.raise_for_status()
            
            return True
            
        except Exception as e:
            logger.error(f"Failed to disable model {model_name}: {e}")
            return False
    
    async def trigger_model_retraining(self, model_name: str, incident: Incident) -> bool:
        """Trigger model retraining"""
        try:
            logger.info(f"Triggering retraining for model {model_name} due to incident {incident.incident_id}")
            
            # Simulate ML pipeline trigger
            pipeline_url = self.config.get('ml_pipeline', {}).get('api_url')
            if pipeline_url:
                response = requests.post(
                    f"{pipeline_url}/retrain/{model_name}",
                    json={
                        "reason": f"Incident {incident.incident_id}",
                        "priority": "high" if incident.severity in [IncidentSeverity.HIGH, IncidentSeverity.CRITICAL] else "normal"
                    },
                    timeout=30
                )
                response.raise_for_status()
            
            return True
            
        except Exception as e:
            logger.error(f"Failed to trigger retraining for {model_name}: {e}")
            return False
    
    async def isolate_data_source(self, data_source: str, incident: Incident) -> bool:
        """Isolate compromised data source"""
        try:
            logger.info(f"Isolating data source {data_source} due to incident {incident.incident_id}")
            
            # Simulate data source isolation
            data_api_url = self.config.get('data_management', {}).get('api_url')
            if data_api_url:
                response = requests.post(
                    f"{data_api_url}/sources/{data_source}/isolate",
                    json={"reason": f"Incident {incident.incident_id}"},
                    timeout=30
                )
                response.raise_for_status()
            
            return True
            
        except Exception as e:
            logger.error(f"Failed to isolate data source {data_source}: {e}")
            return False
    
    async def create_jira_ticket(self, incident: Incident) -> Optional[str]:
        """Create JIRA ticket for incident"""
        try:
            jira_config = self.config.get('jira', {})
            if not jira_config.get('enabled', False):
                return None
            
            ticket_data = {
                "fields": {
                    "project": {"key": jira_config.get('project_key', 'AIGOV')},
                    "summary": f"[{incident.severity.value.upper()}] {incident.title}",
                    "description": incident.description,
                    "issuetype": {"name": "Bug"},
                    "priority": {"name": "High" if incident.severity in [IncidentSeverity.HIGH, IncidentSeverity.CRITICAL] else "Medium"},
                    "labels": ["ai-governance", incident.incident_type.value, incident.severity.value]
                }
            }
            
            response = requests.post(
                f"{jira_config['url']}/rest/api/2/issue",
                json=ticket_data,
                auth=(jira_config['username'], jira_config['token']),
                timeout=30
            )
            response.raise_for_status()
            
            ticket_key = response.json()['key']
            logger.info(f"Created JIRA ticket {ticket_key} for incident {incident.incident_id}")
            return ticket_key
            
        except Exception as e:
            logger.error(f"Failed to create JIRA ticket: {e}")
            return None

class IncidentManager:
    """Main incident management system"""
    
    def __init__(self, config_path: str = "governance/config/incident_config.yaml"):
        self.config = self.load_config(config_path)
        self.db = IncidentDatabase()
        self.notification_service = NotificationService(self.config)
        self.automated_actions = AutomatedActions(self.config)
        self.escalation_rules = self.load_escalation_rules()
        
        # SLA thresholds (in minutes)
        self.sla_thresholds = {
            IncidentSeverity.CRITICAL: 15,  # 15 minutes
            IncidentSeverity.HIGH: 60,      # 1 hour
            IncidentSeverity.MEDIUM: 240,   # 4 hours
            IncidentSeverity.LOW: 1440      # 24 hours
        }
    
    def load_config(self, config_path: str) -> Dict[str, Any]:
        """Load configuration from YAML file"""
        try:
            with open(config_path, 'r') as f:
                return yaml.safe_load(f)
        except Exception as e:
            logger.warning(f"Failed to load config: {e}")
            return self.get_default_config()
    
    def get_default_config(self) -> Dict[str, Any]:
        """Get default configuration"""
        return {
            "escalation": {
                "enabled": True,
                "check_interval_minutes": 5
            },
            "notifications": {
                "email": {
                    "enabled": True,
                    "smtp_server": "smtp.gmail.com",
                    "smtp_port": 587
                },
                "slack": {
                    "enabled": True,
                    "default_channel": "#ai-governance"
                },
                "teams": {
                    "enabled": False
                }
            },
            "automation": {
                "enabled": True,
                "auto_disable_models": True,
                "auto_create_tickets": True
            },
            "stakeholders": {
                "ai_ethics_board": "ai-ethics@aerofusionxr.com",
                "dpo": "dpo@aerofusionxr.com",
                "ciso": "ciso@aerofusionxr.com",
                "ai_lead": "ai-lead@aerofusionxr.com"
            }
        }
    
    def load_escalation_rules(self) -> List[EscalationRule]:
        """Load escalation rules"""
        return [
            EscalationRule(
                rule_id="ESC-001",
                incident_type=IncidentType.BIAS_DETECTION,
                severity=IncidentSeverity.HIGH,
                time_threshold_minutes=30,
                escalate_to="ai_ethics_board",
                notification_channels=["email", "slack"],
                auto_actions=["disable_model", "create_ticket"]
            ),
            EscalationRule(
                rule_id="ESC-002",
                incident_type=IncidentType.PRIVACY_VIOLATION,
                severity=IncidentSeverity.HIGH,
                time_threshold_minutes=15,
                escalate_to="dpo",
                notification_channels=["email", "slack"],
                auto_actions=["isolate_data_source", "create_ticket"]
            ),
            EscalationRule(
                rule_id="ESC-003",
                incident_type=IncidentType.SECURITY_BREACH,
                severity=IncidentSeverity.CRITICAL,
                time_threshold_minutes=5,
                escalate_to="ciso",
                notification_channels=["email", "slack", "teams"],
                auto_actions=["disable_model", "isolate_data_source", "create_ticket"]
            ),
            EscalationRule(
                rule_id="ESC-004",
                incident_type=IncidentType.MODEL_DRIFT,
                severity=IncidentSeverity.MEDIUM,
                time_threshold_minutes=120,
                escalate_to="ai_lead",
                notification_channels=["email"],
                auto_actions=["trigger_retraining", "create_ticket"]
            )
        ]
    
    async def create_incident(self, incident_type: IncidentType, severity: IncidentSeverity,
                            title: str, description: str, affected_system: str,
                            detected_by: str, metadata: Optional[Dict[str, Any]] = None) -> Incident:
        """Create new incident"""
        
        incident = Incident(
            incident_id=f"INC-{datetime.now().strftime('%Y%m%d')}-{str(uuid.uuid4())[:8].upper()}",
            incident_type=incident_type,
            severity=severity,
            title=title,
            description=description,
            affected_system=affected_system,
            detected_by=detected_by,
            detection_time=datetime.now(),
            status=IncidentStatus.OPEN,
            metadata=metadata or {}
        )
        
        # Store in database
        self.db.insert_incident(incident)
        
        # Send initial notifications
        await self.send_incident_notifications(incident, "created")
        
        # Execute immediate automated actions for critical incidents
        if severity == IncidentSeverity.CRITICAL:
            await self.execute_automated_actions(incident)
        
        logger.info(f"Created incident {incident.incident_id}")
        return incident
    
    async def update_incident_status(self, incident_id: str, new_status: IncidentStatus,
                                   assigned_to: Optional[str] = None,
                                   notes: Optional[str] = None) -> bool:
        """Update incident status"""
        incident = self.db.get_incident(incident_id)
        if not incident:
            logger.error(f"Incident {incident_id} not found")
            return False
        
        old_status = incident.status
        incident.status = new_status
        
        if assigned_to:
            incident.assigned_to = assigned_to
        
        if new_status in [IncidentStatus.RESOLVED, IncidentStatus.CLOSED]:
            incident.resolution_time = datetime.now()
        
        # Update database
        self.db.update_incident(incident)
        
        # Send status update notifications
        await self.send_incident_notifications(incident, "updated", notes)
        
        logger.info(f"Updated incident {incident_id} status from {old_status.value} to {new_status.value}")
        return True
    
    async def send_incident_notifications(self, incident: Incident, action: str,
                                        notes: Optional[str] = None):
        """Send incident notifications"""
        try:
            # Determine recipients based on severity and type
            recipients = self.get_notification_recipients(incident)
            
            # Email notification
            if self.config.get('notifications', {}).get('email', {}).get('enabled', False):
                subject = f"[{incident.severity.value.upper()}] Incident {incident.incident_id} {action}"
                body = f"""
Incident {incident.incident_id} has been {action}.

Title: {incident.title}
Severity: {incident.severity.value.upper()}
Type: {incident.incident_type.value.replace('_', ' ').title()}
System: {incident.affected_system}
Status: {incident.status.value.upper()}
Detection Time: {incident.detection_time.strftime('%Y-%m-%d %H:%M:%S')}

Description:
{incident.description}
"""
                if notes:
                    body += f"\n\nNotes: {notes}"
                
                await self.notification_service.send_email(recipients, subject, body, incident)
            
            # Slack notification
            if self.config.get('notifications', {}).get('slack', {}).get('enabled', False):
                channel = self.config['notifications']['slack'].get('default_channel', '#ai-governance')
                message = f"Incident {incident.incident_id} {action} - {incident.title}"
                await self.notification_service.send_slack_notification(channel, message, incident)
            
        except Exception as e:
            logger.error(f"Failed to send incident notifications: {e}")
    
    def get_notification_recipients(self, incident: Incident) -> List[str]:
        """Get notification recipients based on incident"""
        recipients = []
        stakeholders = self.config.get('stakeholders', {})
        
        # Always notify AI governance team
        if 'ai_ethics_board' in stakeholders:
            recipients.append(stakeholders['ai_ethics_board'])
        
        # Add specific stakeholders based on incident type
        if incident.incident_type == IncidentType.PRIVACY_VIOLATION and 'dpo' in stakeholders:
            recipients.append(stakeholders['dpo'])
        elif incident.incident_type == IncidentType.SECURITY_BREACH and 'ciso' in stakeholders:
            recipients.append(stakeholders['ciso'])
        elif incident.incident_type in [IncidentType.MODEL_DRIFT, IncidentType.BIAS_DETECTION] and 'ai_lead' in stakeholders:
            recipients.append(stakeholders['ai_lead'])
        
        # Add escalated recipient if applicable
        if incident.escalated_to and incident.escalated_to in stakeholders:
            recipients.append(stakeholders[incident.escalated_to])
        
        return list(set(recipients))  # Remove duplicates
    
    async def execute_automated_actions(self, incident: Incident):
        """Execute automated remediation actions"""
        if not self.config.get('automation', {}).get('enabled', False):
            return
        
        try:
            # Find applicable escalation rules
            applicable_rules = [
                rule for rule in self.escalation_rules
                if rule.incident_type == incident.incident_type and rule.severity == incident.severity
            ]
            
            for rule in applicable_rules:
                for action in rule.auto_actions:
                    success = False
                    
                    if action == "disable_model" and self.config.get('automation', {}).get('auto_disable_models', False):
                        success = await self.automated_actions.disable_model(incident.affected_system, incident)
                    elif action == "trigger_retraining":
                        success = await self.automated_actions.trigger_model_retraining(incident.affected_system, incident)
                    elif action == "isolate_data_source":
                        success = await self.automated_actions.isolate_data_source(incident.affected_system, incident)
                    elif action == "create_ticket" and self.config.get('automation', {}).get('auto_create_tickets', False):
                        ticket_id = await self.automated_actions.create_jira_ticket(incident)
                        success = ticket_id is not None
                        if success:
                            incident.metadata['jira_ticket'] = ticket_id
                    
                    if success:
                        incident.remediation_actions.append(f"Automated: {action}")
                        logger.info(f"Executed automated action '{action}' for incident {incident.incident_id}")
                    else:
                        logger.warning(f"Failed to execute automated action '{action}' for incident {incident.incident_id}")
            
            # Update incident with remediation actions
            self.db.update_incident(incident)
            
        except Exception as e:
            logger.error(f"Failed to execute automated actions for incident {incident.incident_id}: {e}")
    
    async def check_escalations(self):
        """Check for incidents that need escalation"""
        try:
            open_incidents = self.db.get_open_incidents()
            current_time = datetime.now()
            
            for incident in open_incidents:
                # Skip if already escalated
                if incident.status == IncidentStatus.ESCALATED:
                    continue
                
                # Check if incident exceeds SLA threshold
                time_elapsed = (current_time - incident.detection_time).total_seconds() / 60
                sla_threshold = self.sla_thresholds.get(incident.severity, 1440)
                
                if time_elapsed > sla_threshold:
                    await self.escalate_incident(incident)
                
                # Check escalation rules
                applicable_rules = [
                    rule for rule in self.escalation_rules
                    if rule.incident_type == incident.incident_type and rule.severity == incident.severity
                ]
                
                for rule in applicable_rules:
                    if time_elapsed > rule.time_threshold_minutes:
                        await self.escalate_incident(incident, rule)
                        break
        
        except Exception as e:
            logger.error(f"Error checking escalations: {e}")
    
    async def escalate_incident(self, incident: Incident, rule: Optional[EscalationRule] = None):
        """Escalate incident"""
        try:
            incident.status = IncidentStatus.ESCALATED
            
            if rule:
                incident.escalated_to = rule.escalate_to
                
                # Execute automated actions
                await self.execute_automated_actions(incident)
            
            # Update database
            self.db.update_incident(incident)
            
            # Send escalation notifications
            await self.send_incident_notifications(incident, "escalated")
            
            logger.info(f"Escalated incident {incident.incident_id}")
            
        except Exception as e:
            logger.error(f"Failed to escalate incident {incident.incident_id}: {e}")
    
    async def generate_incident_report(self, start_date: datetime, end_date: datetime) -> Dict[str, Any]:
        """Generate incident report for date range"""
        try:
            with self.db.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute('''
                    SELECT * FROM incidents 
                    WHERE detection_time BETWEEN ? AND ?
                    ORDER BY detection_time DESC
                ''', (start_date.isoformat(), end_date.isoformat()))
                
                incidents = []
                for row in cursor.fetchall():
                    incidents.append({
                        'incident_id': row[1],
                        'incident_type': row[2],
                        'severity': row[3],
                        'title': row[4],
                        'detection_time': row[8],
                        'status': row[9],
                        'resolution_time': row[12]
                    })
                
                # Calculate metrics
                total_incidents = len(incidents)
                resolved_incidents = len([i for i in incidents if i['status'] in ['resolved', 'closed']])
                
                # Calculate average resolution time
                resolution_times = []
                for incident in incidents:
                    if incident['resolution_time']:
                        detection = datetime.fromisoformat(incident['detection_time'])
                        resolution = datetime.fromisoformat(incident['resolution_time'])
                        resolution_times.append((resolution - detection).total_seconds() / 3600)  # hours
                
                avg_resolution_time = sum(resolution_times) / len(resolution_times) if resolution_times else 0
                
                # Group by severity and type
                severity_breakdown = {}
                type_breakdown = {}
                
                for incident in incidents:
                    severity = incident['severity']
                    incident_type = incident['incident_type']
                    
                    severity_breakdown[severity] = severity_breakdown.get(severity, 0) + 1
                    type_breakdown[incident_type] = type_breakdown.get(incident_type, 0) + 1
                
                return {
                    'report_period': {
                        'start_date': start_date.isoformat(),
                        'end_date': end_date.isoformat()
                    },
                    'summary': {
                        'total_incidents': total_incidents,
                        'resolved_incidents': resolved_incidents,
                        'resolution_rate': (resolved_incidents / total_incidents * 100) if total_incidents > 0 else 0,
                        'average_resolution_time_hours': round(avg_resolution_time, 2)
                    },
                    'breakdown': {
                        'by_severity': severity_breakdown,
                        'by_type': type_breakdown
                    },
                    'incidents': incidents
                }
        
        except Exception as e:
            logger.error(f"Failed to generate incident report: {e}")
            return {}
    
    async def run_monitoring_loop(self):
        """Run continuous monitoring loop"""
        logger.info("Starting incident monitoring loop")
        
        while True:
            try:
                await self.check_escalations()
                
                # Sleep for configured interval
                interval = self.config.get('escalation', {}).get('check_interval_minutes', 5)
                await asyncio.sleep(interval * 60)
                
            except KeyboardInterrupt:
                logger.info("Monitoring loop stopped by user")
                break
            except Exception as e:
                logger.error(f"Error in monitoring loop: {e}")
                await asyncio.sleep(60)  # Wait 1 minute before retrying

async def main():
    """Main function for incident automation"""
    import argparse
    
    parser = argparse.ArgumentParser(description='AI Governance Incident Automation')
    parser.add_argument('--mode', choices=['monitor', 'create', 'report'], default='monitor',
                       help='Operation mode')
    parser.add_argument('--incident-type', help='Incident type for creation')
    parser.add_argument('--severity', choices=['low', 'medium', 'high', 'critical'],
                       help='Incident severity for creation')
    parser.add_argument('--title', help='Incident title for creation')
    parser.add_argument('--description', help='Incident description for creation')
    parser.add_argument('--system', help='Affected system for creation')
    
    args = parser.parse_args()
    
    # Initialize incident manager
    manager = IncidentManager()
    
    if args.mode == 'monitor':
        await manager.run_monitoring_loop()
    elif args.mode == 'create':
        if not all([args.incident_type, args.severity, args.title, args.description, args.system]):
            logger.error("All incident details required for creation")
            return
        
        incident = await manager.create_incident(
            incident_type=IncidentType(args.incident_type),
            severity=IncidentSeverity(args.severity),
            title=args.title,
            description=args.description,
            affected_system=args.system,
            detected_by="CLI"
        )
        logger.info(f"Created incident: {incident.incident_id}")
    elif args.mode == 'report':
        end_date = datetime.now()
        start_date = end_date - timedelta(days=30)
        report = await manager.generate_incident_report(start_date, end_date)
        print(json.dumps(report, indent=2, default=str))

if __name__ == "__main__":
    asyncio.run(main())