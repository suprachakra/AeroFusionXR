from fastapi import FastAPI
from routers.flight_router import router as flight_router
from routers.schedule_router import router as schedule_router

app = FastAPI(title="Flight Info Service", version="1.0.0")
app.add_event_handler("startup", lambda: print("Flight Info starting"))
app.include_router(flight_router, prefix="/flights", tags=["flights"])
app.include_router(schedule_router, prefix="/schedules", tags=["schedules"])
