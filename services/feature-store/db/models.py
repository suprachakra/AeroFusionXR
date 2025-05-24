from sqlalchemy import create_engine, Column, String, JSON
from sqlalchemy.orm import declarative_base, sessionmaker

Base = declarative_base()
engine = create_engine(process.env.DB_URI)
Session = sessionmaker(bind=engine)

class Feature(Base):
    __tablename__ = 'features'
    name = Column(String, primary_key=True)
    payload = Column(JSON)

Base.metadata.create_all(engine)

def store_feature(data):
    session = Session()
    feat = Feature(name=data['name'], payload=data)
    session.add(feat)
    session.commit()
    return {"status":"stored"}
