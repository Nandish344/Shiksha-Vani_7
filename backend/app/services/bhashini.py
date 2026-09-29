"""Thin client for Bhashini's (ULCA) inference pipeline: translation + ASR.

Get credentials: https://bhashini.gov.in  ->  Sign up -> ULCA -> My Profile -> Generate API key.
Set BHASHINI_USER_ID and BHASHINI_API_KEY. Language coverage differs per model;
check the Bhashini model catalogue for Santali / Mundari / Ho / Kurukh before relying on them.
Override a code if needed:  BHASHINI_CODE_OVERRIDES="unr=mun,hoc=hoc"
"""
import logging
import os

import httpx

from ..config import settings

log = logging.getLogger("bhashini")

CONFIG_URL = "https://meity-auth.ulcacontrib.org/ulca/apis/v0/model/getModelsPipeline"
PIPELINE_ID = "64392f96daac500b55c543cd"  # Bhashini's public MeitY pipeline
TIMEOUT = 12.0


def _overrides() -> dict:
    raw = os.getenv("BHASHINI_CODE_OVERRIDES", "")
    return dict(p.split("=", 1) for p in raw.split(",") if "=" in p)


def code(lang: str) -> str:
    return _overrides().get(lang, lang)


class BhashiniError(Exception):
    pass


class Bhashini:
    def __init__(self):
        self._cfg_cache: dict = {}

    @property
    def enabled(self) -> bool:
        return bool(settings.BHASHINI_USER_ID and settings.BHASHINI_API_KEY)

    def _config(self, task: dict, cache_key: tuple) -> dict:
        if cache_key in self._cfg_cache:
            return self._cfg_cache[cache_key]
        headers = {
            "Content-Type": "application/json",
            "userID": settings.BHASHINI_USER_ID,
            "ulcaApiKey": settings.BHASHINI_API_KEY,
        }
        body = {"pipelineTasks": [task], "pipelineRequestConfig": {"pipelineId": PIPELINE_ID}}
        r = httpx.post(CONFIG_URL, json=body, headers=headers, timeout=TIMEOUT)
        if r.status_code != 200:
            raise BhashiniError(f"config {r.status_code}: {r.text[:200]}")
        cfg = r.json()
        self._cfg_cache[cache_key] = cfg
        return cfg

    def _run(self, cfg: dict, task: dict, input_data: dict) -> dict:
        endpoint = cfg["pipelineInferenceAPIEndPoint"]
        key = endpoint["inferenceApiKey"]
        service_id = cfg["pipelineResponseConfig"][0]["config"][0]["serviceId"]
        task["config"]["serviceId"] = service_id
        r = httpx.post(
            endpoint["callbackUrl"],
            json={"pipelineTasks": [task], "inputData": input_data},
            headers={key["name"]: key["value"], "Content-Type": "application/json"},
            timeout=TIMEOUT,
        )
        if r.status_code != 200:
            raise BhashiniError(f"inference {r.status_code}: {r.text[:200]}")
        return r.json()

    def translate(self, text: str, src: str, tgt: str) -> str:
        lang = {"sourceLanguage": code(src), "targetLanguage": code(tgt)}
        task = {"taskType": "translation", "config": {"language": lang}}
        cfg = self._config(task, ("mt", src, tgt))
        out = self._run(cfg, {"taskType": "translation", "config": {"language": dict(lang)}}, {"input": [{"source": text}]})
        try:
            return out["pipelineResponse"][0]["output"][0]["target"].strip()
        except (KeyError, IndexError) as e:
            raise BhashiniError(f"unexpected translation response: {e}")

    def asr(self, audio_b64: str, lang: str) -> str:
        lang_cfg = {"sourceLanguage": code(lang)}
        task = {"taskType": "asr", "config": {"language": lang_cfg}}
        cfg = self._config(task, ("asr", lang))
        run_task = {
            "taskType": "asr",
            "config": {"language": dict(lang_cfg), "audioFormat": "wav", "samplingRate": 16000},
        }
        out = self._run(cfg, run_task, {"audio": [{"audioContent": audio_b64}]})
        try:
            return out["pipelineResponse"][0]["output"][0]["source"].strip()
        except (KeyError, IndexError) as e:
            raise BhashiniError(f"unexpected ASR response: {e}")


bhashini = Bhashini()
