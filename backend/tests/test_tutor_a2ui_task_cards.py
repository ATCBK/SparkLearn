from app.routes.tutor_eval import (
    TutorReq,
    _build_a2ui_task_card_events,
    _should_emit_a2ui_task_cards,
    _should_use_a2ui_ui_only,
)


def test_should_emit_a2ui_task_cards_for_learning_plan_request():
    assert _should_emit_a2ui_task_cards("帮我安排本周 Python 学习任务卡，做成多张任务卡", "knowledge_qa") is True


def test_should_not_emit_a2ui_task_cards_for_image_mode():
    assert _should_emit_a2ui_task_cards("帮我生成一张学习主题图", "image_gen") is False


def test_build_a2ui_task_card_events_returns_surface_data_and_component():
    events = _build_a2ui_task_card_events(
        "帮我安排本周 Python 学习任务卡",
        "可以按三步走：基础语法、练习、复盘。",
        12,
    )

    assert [list(event.keys())[0] for event in events] == ["createSurface", "updateDataModel", "updateComponents"]
    assert events[0]["createSurface"]["protocol"] == "a2ui"
    assert events[0]["createSurface"]["version"] == "0.9.1"
    assert events[0]["createSurface"]["surfaceId"] == "sparklearn-task-cards-12"
    assert events[0]["createSurface"]["catalogId"] == "sparklearn.task_cards.v1"

    tasks = events[1]["updateDataModel"]["value"]["tasks"]
    assert len(tasks) == 3
    assert tasks[0]["title"] == "夯实核心概念"
    assert tasks[0]["media"]["type"] == "document"
    assert tasks[1]["media"]["type"] == "quiz"
    assert tasks[2]["media"]["type"] == "video"
    assert tasks[0]["actions"][0]["name"] == "complete_task"
    assert tasks[1]["actions"][1]["name"] == "open_media"
    assert tasks[2]["actions"][2]["name"] == "add_to_path"
    assert events[2]["updateComponents"]["components"][0]["component"] == "SparkTaskCards"


def test_should_use_a2ui_ui_only_when_page_context_mode_is_enabled():
    req = TutorReq(
        message="帮我安排本周 Python 学习",
        page_context={"modes": {"a2ui_panel": True}},
    )

    assert _should_use_a2ui_ui_only(req, "knowledge_qa") is True


def test_a2ui_ui_only_uses_single_personalized_panel_component():
    events = _build_a2ui_task_card_events(
        "帮我安排本周 Python 学习",
        "",
        12,
        ui_only=True,
        profile={
            "name": "李明",
            "weak_points": ["函数返回值"],
            "learning_preference": ["视频教程"],
            "daily_time": 25,
            "current_stage": "函数与模块",
        },
    )

    value = events[1]["updateDataModel"]["value"]
    assert value["uiOnly"] is True
    assert value["learner"]["name"] == "李明"
    assert value["nextAction"]["media"]["type"] == "video"
    assert len(value["tasks"]) == 3
    assert events[2]["updateComponents"]["components"][0]["component"] == "PersonalizedLearningPanel"
