from app.routes import tutor_eval


def test_extract_weather_city_ignores_appended_resource_context():
    question = (
        'get_weather 查询 信阳 用户已生成资源库上下文（资源推荐或学习建议时优先引用 只引用下列真实存在 ）'
    )

    city = tutor_eval._extract_weather_city(question)

    assert city == "信阳"


def test_infer_mcp_tool_args_for_weather_ignores_appended_context():
    question = (
        '帮我查一下信阳天气 用户已生成资源库上下文（资源推荐或学习建议时优先引用 只引用下列真实存在 ）'
    )

    args = tutor_eval._infer_mcp_tool_args(question, "get_weather", "天气预报")

    assert args == {"city": "信阳"}
