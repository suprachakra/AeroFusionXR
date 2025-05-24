from sqlalchemy import Column, Integer, String, JSON, create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

Base = declarative_base()
engine = create_engine(process.env.DB_URI)
Session = sessionmaker(bind=engine)
session = Session()

class ModelMeta(Base):
    __tablename__ = 'models'
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String)
    version = Column(String)
    metadata = Column(JSON)

Base.metadata.create_all(engine)
