"""Carrega e valida `areas.yaml`: áreas, subáreas, palavras-chave e fontes."""

from pathlib import Path
from typing import Any, Literal, Self

import yaml
from pydantic import BaseModel, ConfigDict, Field, ValidationError, model_validator

from one_percent.domain.models import ContentKind

DEFAULT_CONFIG_PATH = Path(__file__).with_name("areas.yaml")

SourceType = Literal["rss", "arxiv", "biorxiv", "hf_daily_papers"]


class ConfigError(ValueError):
    """`areas.yaml` inválido."""


class _Strict(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)


class SubareaConfig(_Strict):
    id: str = Field(pattern=r"^[a-z]+\.[a-z0-9-]+$")
    name: str
    keywords: tuple[str, ...] = ()


class AreaConfig(_Strict):
    id: str = Field(pattern=r"^[a-z]+$")
    name: str
    subareas: tuple[SubareaConfig, ...] = Field(min_length=1)

    @property
    def keywords_by_subarea(self) -> dict[str, list[str]]:
        return {subarea.id: list(subarea.keywords) for subarea in self.subareas}


class SourceConfig(_Strict):
    id: str = Field(pattern=r"^[a-z0-9-]+$")
    name: str
    kind: ContentKind
    type: SourceType
    area: str
    default_subarea: str
    weight: float = Field(default=1.0, gt=0)
    url: str | None = Field(default=None, pattern=r"^https://\S+$")
    query: str | None = None
    server: Literal["biorxiv", "medrxiv"] | None = None
    categories: tuple[str, ...] = ()

    @model_validator(mode="after")
    def _type_specific_fields(self) -> Self:
        required = {"rss": "url", "arxiv": "query", "biorxiv": "server"}.get(self.type)
        if required and getattr(self, required) is None:
            raise ValueError(f"fonte '{self.id}' do tipo {self.type} precisa de '{required}'")
        return self


class PipelineConfig(_Strict):
    areas: tuple[AreaConfig, ...] = Field(min_length=1)
    sources: tuple[SourceConfig, ...] = Field(min_length=1)

    @model_validator(mode="after")
    def _consistent_references(self) -> Self:
        subareas_by_area = {area.id: {s.id for s in area.subareas} for area in self.areas}
        for source in self.sources:
            if source.default_subarea not in subareas_by_area.get(source.area, set()):
                raise ValueError(
                    f"fonte '{source.id}': subárea '{source.default_subarea}' "
                    f"não pertence à área '{source.area}'"
                )
        areas_without_source = set(subareas_by_area) - {source.area for source in self.sources}
        if areas_without_source:
            raise ValueError(f"áreas sem nenhuma fonte: {sorted(areas_without_source)}")
        return self

    def area(self, area_id: str) -> AreaConfig:
        return next(area for area in self.areas if area.id == area_id)


def parse_config(raw: Any) -> PipelineConfig:
    try:
        return PipelineConfig.model_validate(raw)
    except ValidationError as error:
        raise ConfigError(str(error)) from error


def load_config(path: Path = DEFAULT_CONFIG_PATH) -> PipelineConfig:
    with path.open(encoding="utf-8") as file:
        return parse_config(yaml.safe_load(file))
