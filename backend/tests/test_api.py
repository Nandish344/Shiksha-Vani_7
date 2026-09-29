import uuid


def test_health_and_languages(client):
    r = client.get("/api/health").json()
    assert r["ok"] and r["capabilities"]["bhashini"] is False
    langs = client.get("/api/languages").json()["languages"]
    assert {"sat", "unr", "hoc", "kru", "hi", "en"} <= {l["code"] for l in langs}


def test_password_login_and_roles(client, sona):
    r = client.post("/api/auth/login", json={"username": "teacher", "password": "demo123"})
    assert r.status_code == 200 and r.json()["user"]["role"] == "teacher"
    assert client.post("/api/auth/login", json={"username": "teacher", "password": "nope"}).status_code == 401
    # a student must not reach teacher endpoints
    assert client.get("/api/teacher/overview", headers=sona).status_code == 403
    assert client.get("/api/teacher/overview").status_code == 401


def test_translation_memory_exact_and_glossary(client):
    r = client.post("/api/translate", json={"text": "Open your books.", "src": "en", "tgt": "hi"}).json()
    assert r["method"] == "memory" and r["status"] == "verified" and "किताबें" in r["text"]
    # tribal vocabulary is available but only as an unverified draft
    r = client.post("/api/translate", json={"text": "tree", "src": "en", "tgt": "sat"}).json()
    assert r["text"] == "daru" and r["status"] == "draft"


def test_missing_translation_is_flagged_not_faked(client):
    r = client.post("/api/translate", json={"text": "The elephant is sleeping under the mango tree.", "src": "en", "tgt": "sat"}).json()
    assert r["status"] == "missing" and r["method"] == "none"


def test_semantic_similarity_and_number_guard(client):
    r = client.post("/api/translate", json={"text": "Please open your books now", "src": "en", "tgt": "hi"}).json()
    assert r["method"] == "similar" and "किताबें" in r["text"] and r["confidence"] >= 0.7


def test_lesson_localized_with_coverage(client, sona):
    lessons = client.get("/api/lessons", headers=sona).json()
    assert len(lessons) >= 6
    nums = next(l for l in lessons if l["slug"] == "numbers-1-to-10")
    full = client.get(f"/api/lessons/{nums['id']}", headers=sona).json()
    assert full["lang"] == "sat"
    assert full["vocab"][0]["term"] == "mit'" and full["vocab"][0]["status"] == "draft"
    assert full["sections"][0]["status"] == "missing"  # honest: no Santali sentence yet
    hi = client.get(f"/api/lessons/{nums['id']}?lang=hi", headers=sona).json()
    assert hi["coverage"] == 1.0 and hi["verified"] == 1.0


def test_sync_is_idempotent(client, sona):
    ev = {"id": str(uuid.uuid4()), "type": "attempt", "payload": {"kind": "quiz", "lesson_id": 1, "score": 90, "seconds": 40}}
    a = client.post("/api/sync", json={"events": [ev]}, headers=sona).json()
    b = client.post("/api/sync", json={"events": [ev]}, headers=sona).json()
    assert a["accepted"] == [ev["id"]] and a["duplicates"] == 0
    assert b["duplicates"] == 1


def test_student_home_and_recommendations(client, sona):
    h = client.get("/api/student/home", headers=sona).json()
    assert h["stats"]["name"] == "Sona Murmu" and len(h["recommendations"]) >= 1
    assert h["word_of_day"]["term"]


def test_teacher_overview_and_alerts_match_deck(client, teacher):
    o = client.get("/api/teacher/overview", headers=teacher).json()
    k = o["kpis"]
    assert k["students"] == 32 and k["languages"] == 4
    names = {a["student"] for a in o["alerts"]}
    assert "Sona Murmu" in names and "Birsa Ho" in names
    assert any(a["kind"] == "inactive" for a in o["alerts"])
    assert len(o["trend"]) == 14


def test_review_queue_edit_verifies_and_is_reused(client, teacher):
    q = client.get("/api/teacher/review?status=draft&lang=sat", headers=teacher).json()
    assert q["items"], "seed drafts expected"
    item = q["items"][0]
    r = client.post(f"/api/teacher/review/{item['id']}", json={"action": "edit", "text": "corrected-term"}, headers=teacher).json()
    assert r["status"] == "verified"
    out = client.post("/api/translate", json={"text": item["src"], "src": item["src_lang"], "tgt": "sat"}).json()
    assert out["text"] == "corrected-term" and out["status"] == "verified"


def test_teacher_can_author_full_sentence_translation(client, teacher, sona):
    body = {"src": "hi", "tgt": "sat", "text": "पौधे जीवित चीज़ें हैं। वे बढ़ते हैं और उन्हें पानी और धूप चाहिए।", "translation": "[teacher-verified santali line]"}
    assert client.post("/api/teacher/translations", json=body, headers=teacher).status_code == 200
    lesson = client.get("/api/lessons/1", headers=sona).json()
    assert lesson["sections"][0]["text"] == "[teacher-verified santali line]" and lesson["sections"][0]["status"] == "verified"


def test_tutor_retrieval_and_word_lookup(client, sona):
    r = client.post("/api/tutor", json={"message": "What do roots do?"}, headers=sona).json()
    assert r["engine"] == "retrieval" and r["sources"] and r["reply_lang"] in ("hi", "sat")
    w = client.post("/api/tutor", json={"message": "what is water in Santali"}, headers=sona).json()
    assert "dak'" in w["reply"] and w["kind"] == "word"
    g = client.post("/api/tutor", json={"message": "Johar"}, headers=sona).json()
    assert g["kind"] == "greeting"


def test_speech_scoring_word_level(client, sona):
    r = client.post("/api/speech/score", json={"target": "Trees give us fruits, shade and fresh air.", "spoken": "trees give us fruits and fresh air", "seconds": 5}, headers=sona).json()
    statuses = [w["status"] for w in r["words"]]
    assert statuses.count("missed") == 1 and statuses.count("ok") == 7
    assert 70 <= r["accuracy"] <= 95 and r["stars"] >= 2


def test_community_words_flow(client, sona, teacher):
    w = client.post("/api/words", json={"language": "sat", "term": "test-term", "meaning_en": "test"}, headers=sona).json()
    assert w["status"] == "draft"
    assert client.post(f"/api/words/{w['id']}/verify", headers=sona).status_code == 403
    assert client.post(f"/api/words/{w['id']}/verify", headers=teacher).status_code == 200
    assert client.post("/api/words", json={"language": "hi", "term": "x", "meaning_en": "y"}, headers=sona).status_code == 400


def test_parent_report_and_messages(client, parent, teacher):
    kids = client.get("/api/parent/children", headers=parent).json()
    assert len(kids) == 1 and kids[0]["report"]["lines"]
    kid_id = kids[0]["stats"]["id"]
    assert client.post("/api/parent/messages", json={"student_id": kid_id, "text": "Sona was sick yesterday."}, headers=parent).status_code == 200
    assert client.post("/api/parent/messages", json={"student_id": 999, "text": "x"}, headers=parent).status_code == 403
    msgs = client.get("/api/teacher/messages", headers=teacher).json()
    assert any("sick" in m["original"] for m in msgs)
    rep = client.get(f"/api/teacher/report/{kid_id}", headers=teacher).json()
    assert rep["hindi"]["lines"][0]["text"] and rep["report_lang"] == "sat"


def test_csv_export(client, teacher):
    r = client.get("/api/teacher/export.csv", headers=teacher)
    assert r.status_code == 200 and r.text.count("\n") >= 33


def test_live_classroom_websocket_end_to_end(client, teacher, sona):
    s = client.post("/api/sessions", json={"title": "Plants", "source_lang": "hi"}, headers=teacher).json()
    tok_t, tok_s = teacher["Authorization"][7:], sona["Authorization"][7:]
    assert client.get("/api/sessions/live", headers=sona).json()[0]["code"] == s["code"]
    with client.websocket_connect(f"/ws/session/{s['code']}?token={tok_t}") as t, client.websocket_connect(f"/ws/session/{s['code']}?token={tok_s}") as st:
        assert t.receive_json()["type"] == "hello"
        assert st.receive_json()["role"] == "student"
        # presence updates
        seen = []
        for _ in range(3):
            m = t.receive_json()
            seen.append(m)
            if m["type"] == "presence" and m["students"]:
                break
        assert any(m["type"] == "presence" and m["students"] for m in seen)
        t.send_json({"type": "utterance", "text": "अपनी किताबें खोलो।"})
        cap = None
        for _ in range(5):
            m = st.receive_json()
            if m["type"] == "caption":
                cap = m
                break
        assert cap and cap["translations"]["en"]["text"] == "Open your books."
        assert cap["translations"]["sat"]["status"] == "missing"
        st.send_json({"type": "confused"})
        got = None
        for _ in range(5):
            m = t.receive_json()
            if m["type"] == "confusion":
                got = m
                break
        assert got and got["name"] == "Sona Murmu"
        t.send_json({"type": "end"})
    client.post(f"/api/sessions/{s['id']}/end", headers=teacher)
    recap = client.get("/api/student/recaps", headers=sona).json()
    assert recap and recap[0]["lines"]


def test_ws_rejects_bad_token(client):
    import pytest
    from starlette.websockets import WebSocketDisconnect
    with pytest.raises(WebSocketDisconnect):
        with client.websocket_connect("/ws/session/SV-0000?token=bad"):
            pass


def test_live_patch_reaches_students_and_recap_hides_approximations(client, teacher, sona):
    s = client.post("/api/sessions", json={"title": "Patch", "source_lang": "hi"}, headers=teacher).json()
    tok_t, tok_s = teacher["Authorization"][7:], sona["Authorization"][7:]
    with client.websocket_connect(f"/ws/session/{s['code']}?token={tok_t}") as t, client.websocket_connect(f"/ws/session/{s['code']}?token={tok_s}") as st:
        t.send_json({"type": "patch", "seq": 1, "lang": "sat", "text": "patched-line"})
        got = None
        for _ in range(6):
            m = st.receive_json()
            if m["type"] == "caption_patch":
                got = m
                break
        assert got and got["text"] == "patched-line" and got["lang"] == "sat"
        t.send_json({"type": "end"})
    client.post(f"/api/sessions/{s['id']}/end", headers=teacher)
    for rec in client.get("/api/student/recaps", headers=sona).json():
        assert all(l["status"] != "approx" for l in rec["lines"])
