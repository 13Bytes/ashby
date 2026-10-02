"""Row filter in Teable's format, applied to the rows of every source (Excel, provided dataset, Teable):
{"conjunction": "and" | "or", "filterSet": [conditions or nested groups]}, a condition being
{"fieldId": <column name>, "operator": ..., "value": ...}. Incomplete conditions are ignored."""
from __future__ import annotations

import math
from datetime import datetime
from typing import Any

# Operators that need no value; all others are ignored while their value is empty.
NO_VALUE_OPERATORS = {"isEmpty", "empty", "isNotEmpty", "notEmpty"}


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
    if value is None or (isinstance(value, float) and math.isnan(value)):     # empty Excel cells are NaN
        return True
    if isinstance(value, str):
        return value.strip() == ""
    if isinstance(value, (list, tuple, set, dict)):
        return len(value) == 0
    return False


def _normalize_string(value: Any) -> str:
    return str(value).strip().lower()


def _same(field_value: Any, target_value: Any) -> bool:
    """Equal as numbers when both are numbers (the value typed in the editor is text), otherwise as text ignoring case."""
    if _is_empty(field_value):
        return False
    left_num, right_num = _as_number(field_value), _as_number(target_value)
    if left_num is not None and right_num is not None:
        return left_num == right_num
    return _normalize_string(field_value) == _normalize_string(target_value)


def _compare_entry(field_value: Any, operator: str, target_value: Any) -> bool:
    op = operator.strip()
    values = _as_iterable(target_value)
    if op not in NO_VALUE_OPERATORS and _is_empty(target_value):
        return True
    if _is_empty(field_value):
        field_value = None

    if op in {"is", "isEqual", "equals"}:
        return _same(field_value, target_value)
    if op in {"isNot", "isNotEqual", "notEqual"}:
        return not _same(field_value, target_value)
    if op in {"isEmpty", "empty"}:
        return _is_empty(field_value)
    if op in {"isNotEmpty", "notEmpty"}:
        return not _is_empty(field_value)

    if op in {"contains", "doesNotContain", "startsWith", "endsWith"}:
        source = _normalize_string(field_value) if field_value is not None else ""
        needle = _normalize_string(target_value)
        if op == "contains":
            return needle in source
        if op == "doesNotContain":
            return needle not in source
        if op == "startsWith":
            return source.startswith(needle)
        return source.endswith(needle)

    if op in {"isAnyOf", "in"}:
        return any(_same(field_value, value) for value in values)
    if op in {"isNoneOf", "notIn"}:
        return not any(_same(field_value, value) for value in values)

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
    if op in {"isGreater", "isGreaterThan", "gt", "isGreaterEqual", "isGreaterThanOrEqual", "gte",
              "isLess", "isLessThan", "lt", "isLessEqual", "isLessThanOrEqual", "lte"}:
        return False        # no number in the cell: the row does not match

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
    if op in {"isAfter", "isOnOrAfter", "isBefore", "isOnOrBefore"}:
        return False

    return True     # unknown operator: ignored


def filter_data(data: list[dict[str, Any]], filters: dict[str, Any] | None):
    if filters is None:
        return data

    return [entry for entry in data if filter_master(entry, filters)]


def filter_master(entry: dict[str, Any], filters: dict[str, Any]) -> bool:
    conjunction = filters.get("conjunction")
    if conjunction is not None:
        filter_set = filters.get("filterSet") or []
        if not filter_set:
            return True
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

    if not isinstance(field_id, str) or not field_id or not isinstance(operator, str):
        return True

    field_value = entry.get(field_id)
    return _compare_entry(field_value, operator, value)
