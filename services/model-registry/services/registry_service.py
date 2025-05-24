from db.registry_schema import ModelMeta, session

def register_model(meta):
    m = ModelMeta(**meta)
    session.add(m)
    session.commit()
    return {"status":"registered","id":m.id}

def get_models():
    return session.query(ModelMeta).all()
