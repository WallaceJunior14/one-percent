import json

from one_percent.config import load_config
from one_percent.contract import SAMPLE_DAY_PATH


def test_config_areas_match_contract_sample() -> None:
    """Configuração, exemplo do contrato e catálogo embutido no app devem coincidir."""
    sample = json.loads(SAMPLE_DAY_PATH.read_text(encoding="utf-8"))
    config = load_config()
    config_areas = [
        {
            "id": a.id,
            "name": a.name,
            "subareas": [{"id": s.id, "name": s.name} for s in a.subareas],
            "groupId": a.group,
            "weight": a.weight,
        }
        for a in config.areas
    ]

    assert config_areas == sample["areas"]
    assert [{"id": g.id, "name": g.name} for g in config.groups] == sample["groups"]
