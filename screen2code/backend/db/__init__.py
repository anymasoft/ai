"""Database module - SINGLE DATABASE for UI + API."""
from .sqlite import (
    init_db,
    get_conn,
    get_api_conn,
    get_db_path,
    save_generation,
    update_generation,
    get_generation,
    list_generations,
    delete_generation,
    record_usage_event,
    save_generation_variant,
    get_generation_variants,
    hash_api_key,
)

__all__ = [
    "init_db",
    "get_conn",
    "get_api_conn",
    "get_db_path",
    "save_generation",
    "update_generation",
    "get_generation",
    "list_generations",
    "delete_generation",
    "record_usage_event",
    "save_generation_variant",
    "get_generation_variants",
    "hash_api_key",
]
