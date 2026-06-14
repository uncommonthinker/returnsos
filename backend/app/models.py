import datetime
from sqlalchemy import Column, Integer, String, Boolean, Float, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from .database import Base

class SystemSetting(Base):
    __tablename__ = "system_settings"
    key = Column(String, primary_key=True, index=True)
    value = Column(String, nullable=False)

class Device(Base):
    __tablename__ = "devices"

    id = Column(Integer, primary_key=True, index=True)
    serial_number = Column(String, unique=True, index=True)
    model = Column(String, nullable=False)
    brand = Column(String, nullable=False)
    
    # Locks & Security
    sim_lock = Column(String, default="UNLOCKED")  # LOCKED, UNLOCKED
    fmip_lock = Column(String, default="UNLOCKED")  # LOCKED, UNLOCKED
    mdm_lock = Column(String, default="UNLOCKED")  # LOCKED, UNLOCKED
    carrier_lock = Column(String, default="UNLOCKED")  # LOCKED, UNLOCKED
    
    # Battery
    battery_health = Column(Integer, default=100)
    battery_swollen = Column(Boolean, default=False)
    
    # Grades & Details
    cosmetic_grade = Column(String, default="A")
    cosmetic_details = Column(String, nullable=True)  # JSON string of cosmetic questionnaire answers
    
    functional_grade = Column(String, default="A")
    functional_details = Column(String, nullable=True)  # JSON string of functional questionnaire answers
    
    # Status
    status = Column(String, default="RECEIVED")  # RECEIVED, TESTING_COMPLETED, DECIDED, COMPLETED
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationships
    decision = relationship("DispositionDecision", back_populates="device", uselist=False)

class DispositionDecision(Base):
    __tablename__ = "disposition_decisions"

    id = Column(Integer, primary_key=True, index=True)
    device_id = Column(Integer, ForeignKey("devices.id"), unique=True)
    recommended_action = Column(String, nullable=False)  # RESELL, REPAIR, CANNIBALIZE, RECYCLE, LOCK_CLEARANCE
    confidence = Column(Float, default=1.0)
    estimated_recovery_value = Column(Float, default=0.0)
    reasoning_json = Column(String, nullable=True)  # Detailed logs from all agents
    final_grade = Column(String, nullable=False)
    is_gemini_processed = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationships
    device = relationship("Device", back_populates="decision")
    audit_logs = relationship("AuditLog", back_populates="decision", cascade="all, delete-orphan")

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    decision_id = Column(Integer, ForeignKey("disposition_decisions.id"))
    agent_name = Column(String, nullable=False)  # Condition, Valuation, Recommendation, Auditor
    status = Column(String, nullable=False)  # PASSED, FAILED, WARNING
    message = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationships
    decision = relationship("DispositionDecision", back_populates="audit_logs")
