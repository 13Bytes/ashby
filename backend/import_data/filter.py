from __future__ import annotations

from datetime import datetime
from typing import Any


def _as_iterable(value: Any) -> list[Any]:
    if value is None:
        return []
    if isinstance(value, list):
        return value
    if isinstance(value, tuple):
        return list(value)
    return [value]


def _as_number(value: Any) -> float | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        stripped = value.strip()
        if not stripped:
            return None
        try:
            return float(stripped)
        except ValueError:
            return None
    return None


def _as_datetime(value: Any) -> datetime | None:
    if isinstance(value, datetime):
        return value
    if isinstance(value, str):
        stripped = value.strip()
        if not stripped:
            return None
        try:
            return datetime.fromisoformat(stripped.replace("Z", "+00:00"))
        except ValueError:
            return None
    return None


def _is_empty(value: Any) -> bool:
    if value is None:
        return True
    if isinstance(value, str):
        return value.strip() == ""
    if isinstance(value, (list, tuple, set, dict)):
        return len(value) == 0
    return False


def _normalize_string(value: Any) -> str:
    return str(value).strip().lower()


def _compare_entry(field_value: Any, operator: str, target_value: Any) -> bool:
    op = operator.strip()
    values = _as_iterable(target_value)

    if op in {"is", "isEqual", "equals"}:
        return field_value == target_value
    if op in {"isNot", "isNotEqual", "notEqual"}:
        return field_value != target_value
    if op in {"isEmpty", "empty"}:
        return _is_empty(field_value)
    if op in {"isNotEmpty", "notEmpty"}:
        return not _is_empty(field_value)

    if op in {"contains", "doesNotContain", "startsWith", "endsWith"}:
        source = _normalize_string(field_value)
        needle = _normalize_string(target_value)
        if op == "contains":
            return needle in source
        if op == "doesNotContain":
            return needle not in source
        if op == "startsWith":
            return source.startswith(needle)
        return source.endswith(needle)

    if op in {"isAnyOf", "in"}:
        return field_value in values
    if op in {"isNoneOf", "notIn"}:
        return field_value not in values

    if op in {"hasEvery", "hasSome"}:
        source_values = set(_as_iterable(field_value))
        target_values = set(values)
        if op == "hasEvery":
            return target_values.issubset(source_values)
        return len(source_values.intersection(target_values)) > 0

    left_num = _as_number(field_value)
    right_num = _as_number(target_value)
    if left_num is not None and right_num is not None:
        if op in {"isGreater", "isGreaterThan", "gt"}:
            return left_num > right_num
        if op in {"isGreaterEqual", "isGreaterThanOrEqual", "gte"}:
            return left_num >= right_num
        if op in {"isLess", "isLessThan", "lt"}:
            return left_num < right_num
        if op in {"isLessEqual", "isLessThanOrEqual", "lte"}:
            return left_num <= right_num

    left_time = _as_datetime(field_value)
    right_time = _as_datetime(target_value)
    if left_time is not None and right_time is not None:
        if op in {"isAfter"}:
            return left_time > right_time
        if op in {"isOnOrAfter"}:
            return left_time >= right_time
        if op in {"isBefore"}:
            return left_time < right_time
        if op in {"isOnOrBefore"}:
            return left_time <= right_time

    return True


def filter_data(data: list[dict[str, Any]], filters: dict[str, Any] | None):
    if filters is None:
        return data

    return [entry for entry in data if filter_master(entry, filters)]


def filter_master(entry: dict[str, Any], filters: dict[str, Any]) -> bool:
    conjunction = filters.get("conjunction")
    if conjunction is not None:
        filter_set = filters.get("filterSet", [])
        if conjunction == "and":
            return all(filter_master(entry, nested_filter) for nested_filter in filter_set)
        if conjunction == "or":
            return any(filter_master(entry, nested_filter) for nested_filter in filter_set)
        return True

    return filter_entry(entry, filters)


def filter_entry(entry: dict[str, Any], filter_clause: dict[str, Any]) -> bool:
    field_id = filter_clause.get("fieldId")
    operator = filter_clause.get("operator")
    value = filter_clause.get("value")

    if not isinstance(field_id, str) or not isinstance(operator, str):
        return True

    field_value = entry.get(field_id)
    return _compare_entry(field_value, operator, value)
