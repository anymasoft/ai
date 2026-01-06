"""Plan configuration for billing system - MVP (no payment)."""

PLANS = {
    "free": {
        "name": "Free",
        "limit_generations": 30,
        "allowed_formats": ["html"],
        "description": "30 HTML generations per month",
        "price_cents": 0,
    },
    "basic": {
        "name": "Basic",
        "limit_generations": 200,
        "allowed_formats": ["html", "react"],
        "description": "200 generations per month (HTML + React)",
        "price_cents": 999,  # $9.99 (not implemented)
    },
    "professional": {
        "name": "Professional",
        "limit_generations": 1000,
        "allowed_formats": ["html", "react", "vue", "svelte"],
        "description": "1000 generations per month (all formats)",
        "price_cents": 2999,  # $29.99 (not implemented)
    },
}


def get_plan(plan_name: str) -> dict:
    """Get plan config by name."""
    return PLANS.get(plan_name, PLANS["free"])


def get_plan_limit(plan_name: str) -> int:
    """Get generation limit for a plan."""
    plan = get_plan(plan_name)
    return plan["limit_generations"]


def is_format_allowed(plan_name: str, format_name: str) -> bool:
    """Check if format is allowed in plan."""
    plan = get_plan(plan_name)
    return format_name in plan["allowed_formats"]
