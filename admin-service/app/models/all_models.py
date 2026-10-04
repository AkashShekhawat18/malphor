from typing import Optional
import datetime

from sqlalchemy import Boolean, Column, DateTime, ForeignKeyConstraint, Index, Integer, REAL, Table, Text, text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

class Base(DeclarativeBase):
    pass


class AcademicYear(Base):
    __tablename__ = 'AcademicYear'
    __table_args__ = (
        Index('AcademicYear_year_key', 'year', unique=True),
    )

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    year: Mapped[str] = mapped_column(Text, nullable=False)
    isCurrent: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text('false'))
    createdAt: Mapped[datetime.datetime] = mapped_column(DateTime, nullable=False, server_default=text('CURRENT_TIMESTAMP'))


class Approval(Base):
    __tablename__ = 'Approval'

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    entityType: Mapped[str] = mapped_column(Text, nullable=False)
    entityId: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(Text, nullable=False, server_default=text("'PENDING'"))
    requestedBy: Mapped[str] = mapped_column(Text, nullable=False)
    createdAt: Mapped[datetime.datetime] = mapped_column(DateTime, nullable=False, server_default=text('CURRENT_TIMESTAMP'))
    updatedAt: Mapped[datetime.datetime] = mapped_column(DateTime, nullable=False)
    reviewedBy: Mapped[Optional[str]] = mapped_column(Text)
    reviewNotes: Mapped[Optional[str]] = mapped_column(Text)


class College(Base):
    __tablename__ = 'College'
    __table_args__ = (
        Index('College_name_key', 'name', unique=True),
    )

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    createdAt: Mapped[datetime.datetime] = mapped_column(DateTime, nullable=False, server_default=text('CURRENT_TIMESTAMP'))
    location: Mapped[Optional[str]] = mapped_column(Text)

    Department: Mapped[list['Department']] = relationship('Department', back_populates='College_')


class Event(Base):
    __tablename__ = 'Event'

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    date: Mapped[datetime.datetime] = mapped_column(DateTime, nullable=False)
    type: Mapped[str] = mapped_column(Text, nullable=False)
    createdAt: Mapped[datetime.datetime] = mapped_column(DateTime, nullable=False, server_default=text('CURRENT_TIMESTAMP'))
    updatedAt: Mapped[datetime.datetime] = mapped_column(DateTime, nullable=False)
    location: Mapped[Optional[str]] = mapped_column(Text)


class Permission(Base):
    __tablename__ = 'Permission'
    __table_args__ = (
        Index('Permission_name_key', 'name', unique=True),
    )

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)

    Role: Mapped[list['Role']] = relationship('Role', secondary='_RolePermissions', back_populates='Permission_')


class QuestionTopic(Base):
    __tablename__ = 'QuestionTopic'
    __table_args__ = (
        Index('QuestionTopic_name_key', 'name', unique=True),
    )

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    name: Mapped[str] = mapped_column(Text, nullable=False)

    ExtractedQuestion: Mapped[list['ExtractedQuestion']] = relationship('ExtractedQuestion', secondary='_QuestionToTopic', back_populates='QuestionTopic_')


class Role(Base):
    __tablename__ = 'Role'
    __table_args__ = (
        Index('Role_name_key', 'name', unique=True),
    )

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)

    Permission_: Mapped[list['Permission']] = relationship('Permission', secondary='_RolePermissions', back_populates='Role')
    Admin: Mapped[list['Admin']] = relationship('Admin', back_populates='Role_')


class Subject(Base):
    __tablename__ = 'Subject'
    __table_args__ = (
        Index('Subject_name_department_semester_key', 'name', 'department', 'semester', unique=True),
    )

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    department: Mapped[str] = mapped_column(Text, nullable=False)
    semester: Mapped[int] = mapped_column(Integer, nullable=False)
    createdAt: Mapped[datetime.datetime] = mapped_column(DateTime, nullable=False, server_default=text('CURRENT_TIMESTAMP'))

    QuestionPaper: Mapped[list['QuestionPaper']] = relationship('QuestionPaper', back_populates='Subject_')
    Resource: Mapped[list['Resource']] = relationship('Resource', back_populates='Subject_')


class SystemSetting(Base):
    __tablename__ = 'SystemSetting'
    __table_args__ = (
        Index('SystemSetting_key_key', 'key', unique=True),
    )

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    key: Mapped[str] = mapped_column(Text, nullable=False)
    value: Mapped[str] = mapped_column(Text, nullable=False)


class User(Base):
    __tablename__ = 'User'
    __table_args__ = (
        Index('User_email_key', 'email', unique=True),
    )

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    email: Mapped[str] = mapped_column(Text, nullable=False)
    password: Mapped[str] = mapped_column(Text, nullable=False)
    role: Mapped[str] = mapped_column(Text, nullable=False, server_default=text("'STUDENT'"))
    createdAt: Mapped[datetime.datetime] = mapped_column(DateTime, nullable=False, server_default=text('CURRENT_TIMESTAMP'))

    Admin: Mapped[list['Admin']] = relationship('Admin', back_populates='User_')
    Announcement: Mapped[list['Announcement']] = relationship('Announcement', back_populates='User_')
    AuditLog: Mapped[list['AuditLog']] = relationship('AuditLog', back_populates='User_')
    Chat: Mapped[list['Chat']] = relationship('Chat', back_populates='User_')
    LoginHistory: Mapped[list['LoginHistory']] = relationship('LoginHistory', back_populates='User_')
    Notification: Mapped[list['Notification']] = relationship('Notification', back_populates='User_')
    QuestionPaper: Mapped[list['QuestionPaper']] = relationship('QuestionPaper', back_populates='User_')
    Resource: Mapped[list['Resource']] = relationship('Resource', back_populates='User_')
    StudentActivity: Mapped[list['StudentActivity']] = relationship('StudentActivity', back_populates='User_')
    StudentProfile: Mapped[list['StudentProfile']] = relationship('StudentProfile', back_populates='User_')
    StudentSettings: Mapped[list['StudentSettings']] = relationship('StudentSettings', back_populates='User_')
    Bookmark: Mapped[list['Bookmark']] = relationship('Bookmark', back_populates='User_')
    DownloadedResource: Mapped[list['DownloadedResource']] = relationship('DownloadedResource', back_populates='User_')
    RecentResource: Mapped[list['RecentResource']] = relationship('RecentResource', back_populates='User_')


class Admin(Base):
    __tablename__ = 'Admin'
    __table_args__ = (
        ForeignKeyConstraint(['roleId'], ['Role.id'], ondelete='RESTRICT', onupdate='CASCADE', name='Admin_roleId_fkey'),
        ForeignKeyConstraint(['userId'], ['User.id'], ondelete='CASCADE', onupdate='CASCADE', name='Admin_userId_fkey'),
        Index('Admin_userId_key', 'userId', unique=True)
    )

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    userId: Mapped[str] = mapped_column(Text, nullable=False)
    roleId: Mapped[str] = mapped_column(Text, nullable=False)
    createdAt: Mapped[datetime.datetime] = mapped_column(DateTime, nullable=False, server_default=text('CURRENT_TIMESTAMP'))
    updatedAt: Mapped[datetime.datetime] = mapped_column(DateTime, nullable=False)

    Role_: Mapped['Role'] = relationship('Role', back_populates='Admin')
    User_: Mapped['User'] = relationship('User', back_populates='Admin')


class Announcement(Base):
    __tablename__ = 'Announcement'
    __table_args__ = (
        ForeignKeyConstraint(['authorId'], ['User.id'], ondelete='RESTRICT', onupdate='CASCADE', name='Announcement_authorId_fkey'),
    )

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    authorId: Mapped[str] = mapped_column(Text, nullable=False)
    createdAt: Mapped[datetime.datetime] = mapped_column(DateTime, nullable=False, server_default=text('CURRENT_TIMESTAMP'))

    User_: Mapped['User'] = relationship('User', back_populates='Announcement')


class AuditLog(Base):
    __tablename__ = 'AuditLog'
    __table_args__ = (
        ForeignKeyConstraint(['userId'], ['User.id'], ondelete='CASCADE', onupdate='CASCADE', name='AuditLog_userId_fkey'),
    )

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    action: Mapped[str] = mapped_column(Text, nullable=False)
    userId: Mapped[str] = mapped_column(Text, nullable=False)
    createdAt: Mapped[datetime.datetime] = mapped_column(DateTime, nullable=False, server_default=text('CURRENT_TIMESTAMP'))
    entityType: Mapped[Optional[str]] = mapped_column(Text)
    entityId: Mapped[Optional[str]] = mapped_column(Text)
    details: Mapped[Optional[str]] = mapped_column(Text)

    User_: Mapped['User'] = relationship('User', back_populates='AuditLog')


class Chat(Base):
    __tablename__ = 'Chat'
    __table_args__ = (
        ForeignKeyConstraint(['userId'], ['User.id'], ondelete='CASCADE', onupdate='CASCADE', name='Chat_userId_fkey'),
    )

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    userId: Mapped[str] = mapped_column(Text, nullable=False)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    createdAt: Mapped[datetime.datetime] = mapped_column(DateTime, nullable=False, server_default=text('CURRENT_TIMESTAMP'))

    User_: Mapped['User'] = relationship('User', back_populates='Chat')
    Message: Mapped[list['Message']] = relationship('Message', back_populates='Chat_')


class Department(Base):
    __tablename__ = 'Department'
    __table_args__ = (
        ForeignKeyConstraint(['collegeId'], ['College.id'], ondelete='CASCADE', onupdate='CASCADE', name='Department_collegeId_fkey'),
        Index('Department_name_key', 'name', unique=True)
    )

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    collegeId: Mapped[str] = mapped_column(Text, nullable=False)
    createdAt: Mapped[datetime.datetime] = mapped_column(DateTime, nullable=False, server_default=text('CURRENT_TIMESTAMP'))

    College_: Mapped['College'] = relationship('College', back_populates='Department')
    Branch: Mapped[list['Branch']] = relationship('Branch', back_populates='Department_')


class LoginHistory(Base):
    __tablename__ = 'LoginHistory'
    __table_args__ = (
        ForeignKeyConstraint(['userId'], ['User.id'], ondelete='CASCADE', onupdate='CASCADE', name='LoginHistory_userId_fkey'),
    )

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    userId: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(Text, nullable=False)
    createdAt: Mapped[datetime.datetime] = mapped_column(DateTime, nullable=False, server_default=text('CURRENT_TIMESTAMP'))
    ipAddress: Mapped[Optional[str]] = mapped_column(Text)
    userAgent: Mapped[Optional[str]] = mapped_column(Text)

    User_: Mapped['User'] = relationship('User', back_populates='LoginHistory')


class Notification(Base):
    __tablename__ = 'Notification'
    __table_args__ = (
        ForeignKeyConstraint(['userId'], ['User.id'], ondelete='CASCADE', onupdate='CASCADE', name='Notification_userId_fkey'),
    )

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    type: Mapped[str] = mapped_column(Text, nullable=False)
    target: Mapped[str] = mapped_column(Text, nullable=False)
    read: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text('false'))
    createdAt: Mapped[datetime.datetime] = mapped_column(DateTime, nullable=False, server_default=text('CURRENT_TIMESTAMP'))
    userId: Mapped[Optional[str]] = mapped_column(Text)

    User_: Mapped[Optional['User']] = relationship('User', back_populates='Notification')


class QuestionPaper(Base):
    __tablename__ = 'QuestionPaper'
    __table_args__ = (
        ForeignKeyConstraint(['subjectId'], ['Subject.id'], ondelete='SET NULL', onupdate='CASCADE', name='QuestionPaper_subjectId_fkey'),
        ForeignKeyConstraint(['uploadedById'], ['User.id'], ondelete='CASCADE', onupdate='CASCADE', name='QuestionPaper_uploadedById_fkey')
    )

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    year: Mapped[int] = mapped_column(Integer, nullable=False)
    semester: Mapped[int] = mapped_column(Integer, nullable=False)
    filePath: Mapped[str] = mapped_column(Text, nullable=False)
    originalFileName: Mapped[str] = mapped_column(Text, nullable=False)
    isProcessed: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text('false'))
    uploadType: Mapped[str] = mapped_column(Text, nullable=False, server_default=text("'HISTORICAL'"))
    uploadedById: Mapped[str] = mapped_column(Text, nullable=False)
    createdAt: Mapped[datetime.datetime] = mapped_column(DateTime, nullable=False, server_default=text('CURRENT_TIMESTAMP'))
    examType: Mapped[Optional[str]] = mapped_column(Text)
    department: Mapped[Optional[str]] = mapped_column(Text)
    academicYear: Mapped[Optional[str]] = mapped_column(Text)
    extractedText: Mapped[Optional[str]] = mapped_column(Text)
    subjectId: Mapped[Optional[str]] = mapped_column(Text)

    Subject_: Mapped[Optional['Subject']] = relationship('Subject', back_populates='QuestionPaper')
    User_: Mapped['User'] = relationship('User', back_populates='QuestionPaper')
    Bookmark: Mapped[list['Bookmark']] = relationship('Bookmark', back_populates='QuestionPaper_')
    ExtractedQuestion: Mapped[list['ExtractedQuestion']] = relationship('ExtractedQuestion', back_populates='QuestionPaper_')
    PaperAnalytics: Mapped[list['PaperAnalytics']] = relationship('PaperAnalytics', back_populates='QuestionPaper_')


class Resource(Base):
    __tablename__ = 'Resource'
    __table_args__ = (
        ForeignKeyConstraint(['subjectId'], ['Subject.id'], ondelete='SET NULL', onupdate='CASCADE', name='Resource_subjectId_fkey'),
        ForeignKeyConstraint(['uploadedById'], ['User.id'], ondelete='CASCADE', onupdate='CASCADE', name='Resource_uploadedById_fkey')
    )

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    fileType: Mapped[str] = mapped_column(Text, nullable=False)
    filePath: Mapped[str] = mapped_column(Text, nullable=False)
    originalFileName: Mapped[str] = mapped_column(Text, nullable=False)
    fileSize: Mapped[int] = mapped_column(Integer, nullable=False)
    department: Mapped[str] = mapped_column(Text, nullable=False)
    semester: Mapped[int] = mapped_column(Integer, nullable=False)
    subjectName: Mapped[str] = mapped_column(Text, nullable=False)
    uploadedById: Mapped[str] = mapped_column(Text, nullable=False)
    createdAt: Mapped[datetime.datetime] = mapped_column(DateTime, nullable=False, server_default=text('CURRENT_TIMESTAMP'))
    description: Mapped[Optional[str]] = mapped_column(Text)
    subjectId: Mapped[Optional[str]] = mapped_column(Text)

    Subject_: Mapped[Optional['Subject']] = relationship('Subject', back_populates='Resource')
    User_: Mapped['User'] = relationship('User', back_populates='Resource')
    Bookmark: Mapped[list['Bookmark']] = relationship('Bookmark', back_populates='Resource_')
    DownloadedResource: Mapped[list['DownloadedResource']] = relationship('DownloadedResource', back_populates='Resource_')
    RecentResource: Mapped[list['RecentResource']] = relationship('RecentResource', back_populates='Resource_')


class StudentActivity(Base):
    __tablename__ = 'StudentActivity'
    __table_args__ = (
        ForeignKeyConstraint(['userId'], ['User.id'], ondelete='CASCADE', onupdate='CASCADE', name='StudentActivity_userId_fkey'),
    )

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    userId: Mapped[str] = mapped_column(Text, nullable=False)
    action: Mapped[str] = mapped_column(Text, nullable=False)
    createdAt: Mapped[datetime.datetime] = mapped_column(DateTime, nullable=False, server_default=text('CURRENT_TIMESTAMP'))
    details: Mapped[Optional[str]] = mapped_column(Text)

    User_: Mapped['User'] = relationship('User', back_populates='StudentActivity')


class StudentProfile(Base):
    __tablename__ = 'StudentProfile'
    __table_args__ = (
        ForeignKeyConstraint(['userId'], ['User.id'], ondelete='CASCADE', onupdate='CASCADE', name='StudentProfile_userId_fkey'),
        Index('StudentProfile_userId_key', 'userId', unique=True)
    )

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    userId: Mapped[str] = mapped_column(Text, nullable=False)
    createdAt: Mapped[datetime.datetime] = mapped_column(DateTime, nullable=False, server_default=text('CURRENT_TIMESTAMP'))
    updatedAt: Mapped[datetime.datetime] = mapped_column(DateTime, nullable=False)
    department: Mapped[Optional[str]] = mapped_column(Text)
    semester: Mapped[Optional[int]] = mapped_column(Integer)
    course: Mapped[Optional[str]] = mapped_column(Text)
    profilePicture: Mapped[Optional[str]] = mapped_column(Text)
    bio: Mapped[Optional[str]] = mapped_column(Text)

    User_: Mapped['User'] = relationship('User', back_populates='StudentProfile')


class StudentSettings(Base):
    __tablename__ = 'StudentSettings'
    __table_args__ = (
        ForeignKeyConstraint(['userId'], ['User.id'], ondelete='CASCADE', onupdate='CASCADE', name='StudentSettings_userId_fkey'),
        Index('StudentSettings_userId_key', 'userId', unique=True)
    )

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    userId: Mapped[str] = mapped_column(Text, nullable=False)
    theme: Mapped[str] = mapped_column(Text, nullable=False, server_default=text("'system'"))
    notifications: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text('true'))
    language: Mapped[str] = mapped_column(Text, nullable=False, server_default=text("'en'"))
    createdAt: Mapped[datetime.datetime] = mapped_column(DateTime, nullable=False, server_default=text('CURRENT_TIMESTAMP'))
    updatedAt: Mapped[datetime.datetime] = mapped_column(DateTime, nullable=False)
    aiPreferences: Mapped[Optional[str]] = mapped_column(Text)

    User_: Mapped['User'] = relationship('User', back_populates='StudentSettings')


t__RolePermissions = Table(
    '_RolePermissions', Base.metadata,
    Column('A', Text, nullable=False),
    Column('B', Text, nullable=False),
    ForeignKeyConstraint(['A'], ['Permission.id'], ondelete='CASCADE', onupdate='CASCADE', name='_RolePermissions_A_fkey'),
    ForeignKeyConstraint(['B'], ['Role.id'], ondelete='CASCADE', onupdate='CASCADE', name='_RolePermissions_B_fkey'),
    Index('_RolePermissions_AB_unique', 'A', 'B', unique=True),
    Index('_RolePermissions_B_index', 'B')
)


class Bookmark(Base):
    __tablename__ = 'Bookmark'
    __table_args__ = (
        ForeignKeyConstraint(['questionPaperId'], ['QuestionPaper.id'], ondelete='CASCADE', onupdate='CASCADE', name='Bookmark_questionPaperId_fkey'),
        ForeignKeyConstraint(['resourceId'], ['Resource.id'], ondelete='CASCADE', onupdate='CASCADE', name='Bookmark_resourceId_fkey'),
        ForeignKeyConstraint(['userId'], ['User.id'], ondelete='CASCADE', onupdate='CASCADE', name='Bookmark_userId_fkey')
    )

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    userId: Mapped[str] = mapped_column(Text, nullable=False)
    createdAt: Mapped[datetime.datetime] = mapped_column(DateTime, nullable=False, server_default=text('CURRENT_TIMESTAMP'))
    resourceId: Mapped[Optional[str]] = mapped_column(Text)
    questionPaperId: Mapped[Optional[str]] = mapped_column(Text)

    QuestionPaper_: Mapped[Optional['QuestionPaper']] = relationship('QuestionPaper', back_populates='Bookmark')
    Resource_: Mapped[Optional['Resource']] = relationship('Resource', back_populates='Bookmark')
    User_: Mapped['User'] = relationship('User', back_populates='Bookmark')


class Branch(Base):
    __tablename__ = 'Branch'
    __table_args__ = (
        ForeignKeyConstraint(['departmentId'], ['Department.id'], ondelete='CASCADE', onupdate='CASCADE', name='Branch_departmentId_fkey'),
    )

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    departmentId: Mapped[str] = mapped_column(Text, nullable=False)
    createdAt: Mapped[datetime.datetime] = mapped_column(DateTime, nullable=False, server_default=text('CURRENT_TIMESTAMP'))

    Department_: Mapped['Department'] = relationship('Department', back_populates='Branch')


class DownloadedResource(Base):
    __tablename__ = 'DownloadedResource'
    __table_args__ = (
        ForeignKeyConstraint(['resourceId'], ['Resource.id'], ondelete='CASCADE', onupdate='CASCADE', name='DownloadedResource_resourceId_fkey'),
        ForeignKeyConstraint(['userId'], ['User.id'], ondelete='CASCADE', onupdate='CASCADE', name='DownloadedResource_userId_fkey')
    )

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    userId: Mapped[str] = mapped_column(Text, nullable=False)
    resourceId: Mapped[str] = mapped_column(Text, nullable=False)
    downloadedAt: Mapped[datetime.datetime] = mapped_column(DateTime, nullable=False, server_default=text('CURRENT_TIMESTAMP'))

    Resource_: Mapped['Resource'] = relationship('Resource', back_populates='DownloadedResource')
    User_: Mapped['User'] = relationship('User', back_populates='DownloadedResource')


class ExtractedQuestion(Base):
    __tablename__ = 'ExtractedQuestion'
    __table_args__ = (
        ForeignKeyConstraint(['questionPaperId'], ['QuestionPaper.id'], ondelete='CASCADE', onupdate='CASCADE', name='ExtractedQuestion_questionPaperId_fkey'),
    )

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    questionText: Mapped[str] = mapped_column(Text, nullable=False)
    questionPaperId: Mapped[str] = mapped_column(Text, nullable=False)
    createdAt: Mapped[datetime.datetime] = mapped_column(DateTime, nullable=False, server_default=text('CURRENT_TIMESTAMP'))
    questionNumber: Mapped[Optional[str]] = mapped_column(Text)
    marks: Mapped[Optional[int]] = mapped_column(Integer)
    topic: Mapped[Optional[str]] = mapped_column(Text)
    section: Mapped[Optional[str]] = mapped_column(Text)
    subParts: Mapped[Optional[str]] = mapped_column(Text)
    unit: Mapped[Optional[str]] = mapped_column(Text)
    embedding: Mapped[Optional[str]] = mapped_column(Text)

    QuestionPaper_: Mapped['QuestionPaper'] = relationship('QuestionPaper', back_populates='ExtractedQuestion')
    QuestionTopic_: Mapped[list['QuestionTopic']] = relationship('QuestionTopic', secondary='_QuestionToTopic', back_populates='ExtractedQuestion')
    ModelAnswer: Mapped[list['ModelAnswer']] = relationship('ModelAnswer', back_populates='ExtractedQuestion_')
    QuestionDiagram: Mapped[list['QuestionDiagram']] = relationship('QuestionDiagram', back_populates='ExtractedQuestion_')
    QuestionEquation: Mapped[list['QuestionEquation']] = relationship('QuestionEquation', back_populates='ExtractedQuestion_')
    QuestionImage: Mapped[list['QuestionImage']] = relationship('QuestionImage', back_populates='ExtractedQuestion_')
    QuestionRewrite: Mapped[list['QuestionRewrite']] = relationship('QuestionRewrite', back_populates='ExtractedQuestion_')
    QuestionTable: Mapped[list['QuestionTable']] = relationship('QuestionTable', back_populates='ExtractedQuestion_')
    SimilarityResult_matchedQuestionId: Mapped[list['SimilarityResult']] = relationship('SimilarityResult', foreign_keys='[SimilarityResult.matchedQuestionId]', back_populates='ExtractedQuestion_')
    SimilarityResult_sourceQuestionId: Mapped[list['SimilarityResult']] = relationship('SimilarityResult', foreign_keys='[SimilarityResult.sourceQuestionId]', back_populates='ExtractedQuestion1')


class Message(Base):
    __tablename__ = 'Message'
    __table_args__ = (
        ForeignKeyConstraint(['chatId'], ['Chat.id'], ondelete='CASCADE', onupdate='CASCADE', name='Message_chatId_fkey'),
    )

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    chatId: Mapped[str] = mapped_column(Text, nullable=False)
    role: Mapped[str] = mapped_column(Text, nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    createdAt: Mapped[datetime.datetime] = mapped_column(DateTime, nullable=False, server_default=text('CURRENT_TIMESTAMP'))
    fileReferences: Mapped[Optional[str]] = mapped_column(Text)

    Chat_: Mapped['Chat'] = relationship('Chat', back_populates='Message')


class PaperAnalytics(Base):
    __tablename__ = 'PaperAnalytics'
    __table_args__ = (
        ForeignKeyConstraint(['questionPaperId'], ['QuestionPaper.id'], ondelete='CASCADE', onupdate='CASCADE', name='PaperAnalytics_questionPaperId_fkey'),
        Index('PaperAnalytics_questionPaperId_key', 'questionPaperId', unique=True)
    )

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    questionPaperId: Mapped[str] = mapped_column(Text, nullable=False)
    overallSimilarity: Mapped[float] = mapped_column(REAL, nullable=False)
    repeatedCount: Mapped[int] = mapped_column(Integer, nullable=False)
    uniqueCount: Mapped[int] = mapped_column(Integer, nullable=False)
    totalQuestions: Mapped[int] = mapped_column(Integer, nullable=False)
    topicDistribution: Mapped[str] = mapped_column(Text, nullable=False)
    yearDistribution: Mapped[str] = mapped_column(Text, nullable=False)
    createdAt: Mapped[datetime.datetime] = mapped_column(DateTime, nullable=False, server_default=text('CURRENT_TIMESTAMP'))

    QuestionPaper_: Mapped['QuestionPaper'] = relationship('QuestionPaper', back_populates='PaperAnalytics')


class RecentResource(Base):
    __tablename__ = 'RecentResource'
    __table_args__ = (
        ForeignKeyConstraint(['resourceId'], ['Resource.id'], ondelete='CASCADE', onupdate='CASCADE', name='RecentResource_resourceId_fkey'),
        ForeignKeyConstraint(['userId'], ['User.id'], ondelete='CASCADE', onupdate='CASCADE', name='RecentResource_userId_fkey')
    )

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    userId: Mapped[str] = mapped_column(Text, nullable=False)
    resourceId: Mapped[str] = mapped_column(Text, nullable=False)
    viewedAt: Mapped[datetime.datetime] = mapped_column(DateTime, nullable=False, server_default=text('CURRENT_TIMESTAMP'))

    Resource_: Mapped['Resource'] = relationship('Resource', back_populates='RecentResource')
    User_: Mapped['User'] = relationship('User', back_populates='RecentResource')


class ModelAnswer(Base):
    __tablename__ = 'ModelAnswer'
    __table_args__ = (
        ForeignKeyConstraint(['extractedQuestionId'], ['ExtractedQuestion.id'], ondelete='CASCADE', onupdate='CASCADE', name='ModelAnswer_extractedQuestionId_fkey'),
    )

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    extractedQuestionId: Mapped[str] = mapped_column(Text, nullable=False)
    answerType: Mapped[str] = mapped_column(Text, nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    createdAt: Mapped[datetime.datetime] = mapped_column(DateTime, nullable=False, server_default=text('CURRENT_TIMESTAMP'))

    ExtractedQuestion_: Mapped['ExtractedQuestion'] = relationship('ExtractedQuestion', back_populates='ModelAnswer')


class QuestionDiagram(Base):
    __tablename__ = 'QuestionDiagram'
    __table_args__ = (
        ForeignKeyConstraint(['extractedQuestionId'], ['ExtractedQuestion.id'], ondelete='CASCADE', onupdate='CASCADE', name='QuestionDiagram_extractedQuestionId_fkey'),
    )

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    extractedQuestionId: Mapped[str] = mapped_column(Text, nullable=False)
    diagramUrl: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)

    ExtractedQuestion_: Mapped['ExtractedQuestion'] = relationship('ExtractedQuestion', back_populates='QuestionDiagram')


class QuestionEquation(Base):
    __tablename__ = 'QuestionEquation'
    __table_args__ = (
        ForeignKeyConstraint(['extractedQuestionId'], ['ExtractedQuestion.id'], ondelete='CASCADE', onupdate='CASCADE', name='QuestionEquation_extractedQuestionId_fkey'),
    )

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    extractedQuestionId: Mapped[str] = mapped_column(Text, nullable=False)
    latex: Mapped[str] = mapped_column(Text, nullable=False)

    ExtractedQuestion_: Mapped['ExtractedQuestion'] = relationship('ExtractedQuestion', back_populates='QuestionEquation')


class QuestionImage(Base):
    __tablename__ = 'QuestionImage'
    __table_args__ = (
        ForeignKeyConstraint(['extractedQuestionId'], ['ExtractedQuestion.id'], ondelete='CASCADE', onupdate='CASCADE', name='QuestionImage_extractedQuestionId_fkey'),
    )

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    extractedQuestionId: Mapped[str] = mapped_column(Text, nullable=False)
    imageUrl: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)

    ExtractedQuestion_: Mapped['ExtractedQuestion'] = relationship('ExtractedQuestion', back_populates='QuestionImage')


class QuestionRewrite(Base):
    __tablename__ = 'QuestionRewrite'
    __table_args__ = (
        ForeignKeyConstraint(['extractedQuestionId'], ['ExtractedQuestion.id'], ondelete='CASCADE', onupdate='CASCADE', name='QuestionRewrite_extractedQuestionId_fkey'),
    )

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    extractedQuestionId: Mapped[str] = mapped_column(Text, nullable=False)
    originalText: Mapped[str] = mapped_column(Text, nullable=False)
    rewrittenText: Mapped[str] = mapped_column(Text, nullable=False)
    createdAt: Mapped[datetime.datetime] = mapped_column(DateTime, nullable=False, server_default=text('CURRENT_TIMESTAMP'))

    ExtractedQuestion_: Mapped['ExtractedQuestion'] = relationship('ExtractedQuestion', back_populates='QuestionRewrite')


class QuestionTable(Base):
    __tablename__ = 'QuestionTable'
    __table_args__ = (
        ForeignKeyConstraint(['extractedQuestionId'], ['ExtractedQuestion.id'], ondelete='CASCADE', onupdate='CASCADE', name='QuestionTable_extractedQuestionId_fkey'),
    )

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    extractedQuestionId: Mapped[str] = mapped_column(Text, nullable=False)
    tableData: Mapped[str] = mapped_column(Text, nullable=False)

    ExtractedQuestion_: Mapped['ExtractedQuestion'] = relationship('ExtractedQuestion', back_populates='QuestionTable')


class SimilarityResult(Base):
    __tablename__ = 'SimilarityResult'
    __table_args__ = (
        ForeignKeyConstraint(['matchedQuestionId'], ['ExtractedQuestion.id'], ondelete='CASCADE', onupdate='CASCADE', name='SimilarityResult_matchedQuestionId_fkey'),
        ForeignKeyConstraint(['sourceQuestionId'], ['ExtractedQuestion.id'], ondelete='CASCADE', onupdate='CASCADE', name='SimilarityResult_sourceQuestionId_fkey')
    )

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    sourceQuestionId: Mapped[str] = mapped_column(Text, nullable=False)
    matchedQuestionId: Mapped[str] = mapped_column(Text, nullable=False)
    similarityScore: Mapped[float] = mapped_column(REAL, nullable=False)
    matchType: Mapped[str] = mapped_column(Text, nullable=False)
    createdAt: Mapped[datetime.datetime] = mapped_column(DateTime, nullable=False, server_default=text('CURRENT_TIMESTAMP'))
    matchedYear: Mapped[Optional[int]] = mapped_column(Integer)
    matchedPaperTitle: Mapped[Optional[str]] = mapped_column(Text)
    matchedSubject: Mapped[Optional[str]] = mapped_column(Text)
    matchedSemester: Mapped[Optional[int]] = mapped_column(Integer)

    ExtractedQuestion_: Mapped['ExtractedQuestion'] = relationship('ExtractedQuestion', foreign_keys=[matchedQuestionId], back_populates='SimilarityResult_matchedQuestionId')
    ExtractedQuestion1: Mapped['ExtractedQuestion'] = relationship('ExtractedQuestion', foreign_keys=[sourceQuestionId], back_populates='SimilarityResult_sourceQuestionId')


t__QuestionToTopic = Table(
    '_QuestionToTopic', Base.metadata,
    Column('A', Text, nullable=False),
    Column('B', Text, nullable=False),
    ForeignKeyConstraint(['A'], ['ExtractedQuestion.id'], ondelete='CASCADE', onupdate='CASCADE', name='_QuestionToTopic_A_fkey'),
    ForeignKeyConstraint(['B'], ['QuestionTopic.id'], ondelete='CASCADE', onupdate='CASCADE', name='_QuestionToTopic_B_fkey'),
    Index('_QuestionToTopic_AB_unique', 'A', 'B', unique=True),
    Index('_QuestionToTopic_B_index', 'B')
)
