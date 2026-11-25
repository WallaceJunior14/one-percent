"""Carrega e valida `pipeline.yaml`: os parâmetros da operação diária.

Campos ausentes ficam com o valor padrão do modelo; campos desconhecidos ou inválidos fazem a
execução parar antes de coletar, com o caminho do campo na mensagem.
"""

from collections.abc import Mapping
from datetime import timedelta
from pathlib import Path
from typing import Any, Literal, Self
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

import yaml
from pydantic import BaseModel, ConfigDict, Field, ValidationError, field_validator, model_validator

from one_percent.domain.models import ContentKind

DEFAULT_SETTINGS_PATH = Path(__file__).with_name("pipeline.yaml")

PromptField = Literal[
    "title", "summary", "why_it_matters", "method", "result", "limitations", "quiz"
]


class SettingsError(ValueError):
    """`pipeline.yaml` inválido."""


class _Strict(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)


class WindowSettings(_Strict):
    news_hours: int = Field(default=36, gt=0)
    paper_days: int = Field(default=7, gt=0)

    @property
    def max_age(self) -> dict[ContentKind, timedelta]:
        return {"news": timedelta(hours=self.news_hours), "paper": timedelta(days=self.paper_days)}


class MinCardsSettings(_Strict):
    total: int = Field(default=15, ge=1)
    per_group: int = Field(default=7, ge=0)


class StorySettings(_Strict):
    min_slides: int = Field(default=3, ge=1)
    max_slides: int = Field(default=5, ge=1)

    @model_validator(mode="after")
    def _ordered(self) -> Self:
        if self.min_slides > self.max_slides:
            raise ValueError("min_slides não pode ser maior que max_slides")
        return self


class QuizSettings(_Strict):
    distractors: int = Field(default=3, ge=1, le=5)


class ContentSettings(_Strict):
    timezone: str = "America/Sao_Paulo"
    publish_deadline: str = Field(default="07:00", pattern=r"^([01]\d|2[0-3]):[0-5]\d$")
    retention_days: int = Field(default=7, ge=1)
    windows: WindowSettings = WindowSettings()
    min_cards: MinCardsSettings = MinCardsSettings()
    stories: StorySettings = StorySettings()
    quiz: QuizSettings = QuizSettings()

    @field_validator("timezone")
    @classmethod
    def _known_timezone(cls, value: str) -> str:
        try:
            ZoneInfo(value)
        except (ZoneInfoNotFoundError, ValueError) as error:
            raise ValueError(f"fuso horário desconhecido: {value!r}") from error
        return value

    @property
    def zone(self) -> ZoneInfo:
        return ZoneInfo(self.timezone)


class FeedSettings(_Strict):
    size: int = Field(default=15, ge=1, le=50)
    min_paper_share: float = Field(default=0.3, ge=0, le=1)
    quiz_questions: int = Field(default=3, ge=0, le=10)
    publish_interval_hours: int = Field(default=24, gt=0, le=168)
    freshness_tolerance_hours: int = Field(default=6, ge=0, le=168)
    seconds_per_card: int = Field(default=40, gt=0, le=600)


class PriceSettings(_Strict):
    """Dólares por milhão de tokens."""

    input: float = Field(default=0.05, ge=0)
    output: float = Field(default=0.25, ge=0)


_DEFAULT_PROMPT_OVERRIDES: Mapping[PromptField, float] = {"title": 0.6, "quiz": 0.5}


class LlmSettings(_Strict):
    model: str = Field(default="claude-haiku-5-5", min_length=1)
    max_items_per_run: int = Field(default=150, ge=1)
    max_tokens: int = Field(default=2048, ge=1)
    batch_timeout_minutes: float = Field(default=25, gt=0)
    prompt_target_ratio: float = Field(default=0.8, gt=0, le=1)
    prompt_target_overrides: Mapping[PromptField, float] = Field(
        default_factory=lambda: _DEFAULT_PROMPT_OVERRIDES
    )
    price_per_mtok: PriceSettings = PriceSettings()

    @field_validator("prompt_target_overrides")
    @classmethod
    def _ratios_in_range(cls, value: Mapping[PromptField, float]) -> Mapping[PromptField, float]:
        for field, ratio in value.items():
            if not 0 < ratio <= 1:
                raise ValueError(f"{field}: a fração precisa estar entre 0 (exclusivo) e 1")
        return value

    def prompt_ratio(self, field: PromptField) -> float:
        return self.prompt_target_overrides.get(field, self.prompt_target_ratio)


class BudgetSettings(_Strict):
    monthly_usd: float = Field(default=5, gt=0)
    alert_ratio: float = Field(default=0.8, gt=0, le=1)


class PipelineSettings(_Strict):
    content: ContentSettings = ContentSettings()
    feed: FeedSettings = FeedSettings()
    llm: LlmSettings = LlmSettings()
    budget: BudgetSettings = BudgetSettings()


def _describe(error: ValidationError) -> str:
    return "; ".join(
        f"{'.'.join(str(part) for part in issue['loc']) or '<raiz>'}: {issue['msg']}"
        for issue in error.errors()
    )


def parse_settings(raw: Any) -> PipelineSettings:
    try:
        return PipelineSettings.model_validate(raw if raw is not None else {})
    except ValidationError as error:
        raise SettingsError(f"configuração inválida: {_describe(error)}") from error


def load_settings(path: Path = DEFAULT_SETTINGS_PATH) -> PipelineSettings:
    try:
        with path.open(encoding="utf-8") as file:
            raw = yaml.safe_load(file)
    except (OSError, yaml.YAMLError) as error:
        raise SettingsError(f"não foi possível ler {path}: {error}") from error
    return parse_settings(raw)
