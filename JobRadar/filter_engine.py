"""
JobRadar v0 - Движок фильтрации сообщений (include/require/exclude)
"""
import logging
from sqlalchemy.orm import Session
from models import FilterRule, FilterTerm

logger = logging.getLogger(__name__)


def init_legacy_filter(db: Session) -> None:
    """
    Создаёт legacy правило при первом запуске, если filter_rules пуста

    Создаёт одну запись:
    - name="Legacy keywords"
    - mode="legacy_or"
    - enabled=True

    Без добавления термов
    """
    existing_rules = db.query(FilterRule).first()
    if not existing_rules:
        legacy_rule = FilterRule(
            name="Legacy keywords",
            mode="legacy_or",
            enabled=True
        )
        db.add(legacy_rule)
        db.commit()
        logger.info("✅ Создано legacy правило фильтрации")


def normalize_text(text: str) -> str:
    """
    Нормализует текст: lowercase + collapse spaces
    """
    if not text:
        return ""
    return " ".join(text.lower().split())


def load_active_filter(db: Session) -> dict:
    """
    Загружает активное правило фильтрации из БД

    Возвращает dict:
    {
        "mode": "legacy_or" или "advanced",
        "include_any": [],
        "require_all": [],
        "exclude_any": []
    }

    Если активного правила нет - возвращает mode="legacy_or"
    """
    active_rule = db.query(FilterRule).filter(FilterRule.enabled == True).first()

    result = {
        "mode": "legacy_or",
        "include_any": [],
        "require_all": [],
        "exclude_any": []
    }

    if not active_rule:
        return result

    result["mode"] = active_rule.mode

    # Загружаем термины этого правила
    terms = db.query(FilterTerm).filter(
        FilterTerm.rule_id == active_rule.id,
        FilterTerm.enabled == True
    ).all()

    for term in terms:
        normalized_value = normalize_text(term.value)
        if term.term_type == "include":
            result["include_any"].append(normalized_value)
        elif term.term_type == "require":
            result["require_all"].append(normalized_value)
        elif term.term_type == "exclude":
            result["exclude_any"].append(normalized_value)

    logger.debug(
        f"Filter result: mode={result['mode']}, "
        f"include={len(result['include_any'])}, "
        f"require={len(result['require_all'])}, "
        f"exclude={len(result['exclude_any'])}"
    )

    return result


def match_text(text: str, filter_config: dict, legacy_keywords: list) -> bool:
    """
    Проверяет, соответствует ли текст правилам фильтрации

    Args:
        text: Текст сообщения
        filter_config: Конфигурация фильтра из load_active_filter()
        legacy_keywords: Список ключевых слов из таблицы Keyword (нижний регистр)

    Returns:
        True если сообщение должно быть опубликовано, иначе False
    """
    normalized_text = normalize_text(text)
    mode = filter_config.get("mode", "legacy_or")

    if mode == "legacy_or":
        # Старый режим: публикуем если хотя бы одно ключевое слово есть в тексте
        return any(kw.lower() in normalized_text for kw in legacy_keywords)

    # Режим "advanced"
    exclude_any = filter_config.get("exclude_any", [])
    require_all = filter_config.get("require_all", [])
    include_any = filter_config.get("include_any", [])

    # 1. Если есть исключаемое слово - не публикуем
    if any(exc in normalized_text for exc in exclude_any):
        return False

    # 2. Если есть требуемые слова - проверяем все ли присутствуют
    if require_all and not all(req in normalized_text for req in require_all):
        return False

    # 3. Если нет include слов - публикуем (были выполнены все остальные условия)
    if not include_any:
        return True

    # 4. Если есть include слова - публикуем если хотя бы одно есть
    return any(inc in normalized_text for inc in include_any)
