import json

from one_percent.config import load_config
from one_percent.contract import SAMPLE_DAY_PATH


def test_config_areas_match_contract_sample() -> None:
    """O app tem um catálogo fixo de áreas; os três (config, exemplo, app) devem coincidir."""
    sample = json.loads(SAMPLE_DAY_PATH.read_text(encoding="utf-8"))
    config_areas = [
        {"id": a.id, "name": a.name, "subareas": [{"id": s.id, "name": s.name} for s in a.subareas]}
        for a in load_config().areas
    ]

    assert config_areas == sample["areas"]
