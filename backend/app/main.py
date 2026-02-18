from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .core.database import Base, engine
from .routers import auth, admin, manager, client

# Create all tables on startup
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Workflow Engine API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "http://frontend:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(admin.router)
app.include_router(manager.router)
app.include_router(client.router)


@app.get("/")
def root():
    return {"message": "Workflow Engine API", "version": "1.0.0"}


@app.get("/health")
def health():
    return {"status": "ok"}
