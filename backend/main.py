import subprocess
import sys
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(title="Python Flow Builder API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class RunRequest(BaseModel):
    code: str


class RunResult(BaseModel):
    stdout: str
    stderr: str
    returncode: int


@app.post("/run", response_model=RunResult)
async def run_code(request: RunRequest):
    try:
        result = subprocess.run(
            [sys.executable, "-c", request.code],
            capture_output=True,
            text=True,
            timeout=10,
        )
        return RunResult(
            stdout=result.stdout,
            stderr=result.stderr,
            returncode=result.returncode,
        )
    except subprocess.TimeoutExpired:
        return RunResult(stdout="", stderr="Error: execution timed out (10s limit)", returncode=1)


@app.get("/health")
async def health():
    return {"status": "ok"}
