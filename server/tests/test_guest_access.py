"""A guest (variant link) may open only the variant they joined through."""

import asyncio
from types import SimpleNamespace

from app.access import can_access_task, can_access_topic, can_access_topic_course, get_content_access


def _guest(topic_id):
    return SimpleNamespace(id=7, role="guest", guest_topic_id=topic_id)


def _topic(topic_id, category="variants", course_type="common"):
    return SimpleNamespace(id=topic_id, category=category, course_type=course_type, tasks=[], open_to_groups=False)


def _access(topic_id):
    # Guests short-circuit before any DB query, so no session is needed.
    return asyncio.run(get_content_access(_guest(topic_id), db=None))


def test_guest_opens_own_variant_and_its_tasks():
    access = _access(5)
    topic = _topic(5)
    assert access.is_guest and not access.can_access_all
    assert can_access_topic_course(topic, access)
    assert can_access_topic(topic, access)
    assert can_access_task(101, access, topic)


def test_guest_cannot_open_other_topics_even_common_ones():
    access = _access(5)
    other = _topic(6, category="tutorial", course_type="common")
    assert not can_access_topic_course(other, access)
    assert not can_access_topic(other, access)
    assert not can_access_task(202, access, other)


def test_guest_without_topic_sees_nothing():
    access = _access(None)
    assert not can_access_topic_course(_topic(5), access)


def test_returning_guest_is_found_by_name_ignoring_case_and_spaces():
    from app.routers.auth import find_returning_guest

    first = SimpleNamespace(id=1, first_name_real="Анна", last_name_real="Иванова")
    other = SimpleNamespace(id=2, first_name_real="Пётр", last_name_real="Петров")
    assert find_returning_guest([first, other], "  анна ", "ИВАНОВА") is first
    assert find_returning_guest([first, other], "Пётр", "Петров") is other
    assert find_returning_guest([first, other], "Анна", "Петрова") is None
    assert find_returning_guest([], "Анна", "Иванова") is None
