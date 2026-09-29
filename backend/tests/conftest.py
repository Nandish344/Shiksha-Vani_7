import os
import tempfile

# Must be set before the app is imported.
_tmp = tempfile.mkdtemp()
os.environ["DATABASE_URL"] = f"sqlite:///{_tmp}/test.db"
os.environ["DEMO_MODE"] = "true"
os.environ.pop("BHASHINI_USER_ID", None)
os.environ.pop("ANTHROPIC_API_KEY", None)

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture(scope="session")
def client():
    with TestClient(app) as c:
        yield c


def _login(client, username):
    r = client.post(f"/api/auth/demo/{username}")
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="session")
def teacher(client):
    return {"Authorization": f"Bearer {_login(client, 'teacher')}"}


@pytest.fixture(scope="session")
def sona(client):
    return {"Authorization": f"Bearer {_login(client, 'sona')}"}


@pytest.fixture(scope="session")
def parent(client):
    return {"Authorization": f"Bearer {_login(client, 'parent')}"}
