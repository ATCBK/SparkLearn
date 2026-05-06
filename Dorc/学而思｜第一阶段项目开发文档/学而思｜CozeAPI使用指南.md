发起对话
https://api.coze.cn/v3/chat
权限点: Bot.chat/Connector.botChat
调用此接口发起一次对话，支持添加上下文和流式响应。 ​
会话、对话和消息的概念说明，可参考基础概念。 ​
接口说明 ​
发起对话接口用于向指定智能体发起一次对话，支持在对话时添加对话的上下文消息，以便智能体基于历史消息做出合理的回复。开发者可以按需选择响应方式，即流式或非流式响应，响应方式决定了开发者获取智能体回复的方式。关于获取智能体回复的详细说明可参考通过对话接口获取智能体回复。 ​
流式响应：智能体在生成回复的同时，将回复消息以数据流的形式逐条发送给客户端。处理结束后，服务端会返回一条完整的智能体回复。详细说明可参考流式响应。 ​
非流式响应：无论对话是否处理完毕，立即发送响应消息。开发者可以通过接口查看对话详情确认本次对话处理结束后，再调用查看对话消息详情接口查看模型回复等完整响应内容。详细说明可参考非流式响应。​
创建会话 API 和发起对话 API 的区别如下：​
创建会话：​
主要用于初始化一个新的会话环境。​
一个会话是Bot和用户之间的一段问答交互，可以包含多条消息。​
创建会话时，可以选择携带初始的消息内容。​
发起对话：​
用于在已经存在的会话中发起一次对话。​
支持添加上下文和流式响应。​
可以基于历史消息进行上下文关联，提供更符合语境的回复。​
Header
token
扣子 API 通过访问令牌进行 API 请求的鉴权。生成方式可以参考鉴权方式
sat_JGKRG441iv59XIrx89x7rSYSliFoGHTqYbTg7RvY8L6ARd1napX0HO226Tbl7Sjj
Query params
conversation_id
标识对话发生在哪一次会话中。
会话是 Bot 和用户之间的一段问答交互。一个会话包含一条或多条消息。对话是会话中对 Bot 的一次调用，Bot 会将对话中产生的消息添加到会话中。
可以使用已创建的会话，会话中已存在的消息将作为上下文传递给模型。创建会话的方式可参考创建会话。
对于一问一答等不需要区分 conversation 的场合可不传该参数，系统会自动生成一个会话
一个会话中，只能有一个进行中的对话，否则调用此接口时会报错 4016。
展开全部
Please enter conversation_id
Body params
bot_id
要进行会话聊天的智能体 ID。
进入智能体的 开发页面，开发页面 URL 中 bot 参数后的数字就是智能体 ID。例如https://www.coze.cn/space/341****/bot/73428668*****，智能体 ID 为73428668*****。
确保当前使用的访问密钥已被授予智能体所属空间的 chat 权限。
展开全部
示例：73428668*****
7630849074828525622
user_id
标识当前与智能体对话的用户，由使用方自行定义、生成与维护。user_id 用于标识对话中的不同用户，不同的 user_id，其对话的上下文消息、数据库等对话记忆数据互相隔离。如果不需要用户数据隔离，可将此参数固定为一个任意字符串，例如 123，abc 等。
出于数据隐私及信息安全等方面的考虑，不建议使用业务系统中定义的用户 ID。
展开全部
示例：123
123456789
stream
是否启用流式返回。
true：采用流式响应。 “流式响应” 将模型的实时响应提供给客户端，类似打字机效果。你可以实时获取服务端返回的对话、消息事件，并在客户端中同步处理、实时展示，也可以直接在 completed 事件中获取智能体最终的回复。
false：（默认）采用非流式响应。 “非流式响应” 是指响应中仅包含本次对话的状态等元数据。此时应同时开启 auto_save_history，在本次对话处理结束后再查看模型回复等完整响应内容。可以参考以下业务流程：
a. 调用发起会话接口，并设置 stream = false，auto_save_history=true，表示使用非流式响应，并记录历史消息。
你需要记录会话的 Conversation ID 和 Chat ID，用于后续查看详细信息。
b. 定期轮询查看对话详情接口，建议每次间隔 1 秒以上，直到会话状态流转为终态，即 status 为 completed、required_action、canceled 或 failed。
c. 调用查看对话消息详情接口，查询大模型生成的最终结果。
展开全部
示例：true
true
additional_messages
对话的附加信息。你可以通过此字段传入历史消息和本次对话中用户的问题。数组长度限制为 100，即最多传入 100 条消息。
若未设置 additional_messages，智能体收到的消息只有会话中已有的消息内容，其中最后一条作为本次对话的用户输入，其他内容均为本次对话的上下文。
若设置了 additional_messages，智能体收到的消息包括会话中已有的消息和 additional_messages 中添加的消息，其中 additional_messages 最后一条消息会作为本次对话的用户输入，其他内容均为本次对话的上下文。
消息结构可参考EnterMessage Object，具体示例可参考携带上下文。
会话或 additional_messages 中最后一条消息应为 role=user 的记录，以免影响模型效果。
如果本次对话未指定会话或指定的会话中无消息时，必须通过此参数传入智能体用户的问题。
展开全部
Object
role
发送这条消息的实体。取值：
user：代表该条消息内容是用户发送的。
assistant：代表该条消息内容是智能体发送的。
展开全部
示例：user
user
type
消息类型。默认为 question。
question：用户输入内容。
answer：智能体返回给用户的消息内容，支持增量返回。如果工作流绑定了输出节点，可能会存在多 answer 场景，此时可以用流式返回的结束标志来判断所有 answer 完成。
function_call：智能体对话过程中调用函数（function call）的中间结果。
tool_response：调用工具 （function call）后返回的结果。
如果 autoSaveHistory=true，type 支持设置为 question 或 answer。
如果 autoSaveHistory=false，type 支持设置为 question、answer、function_call、tool_output/tool_response。
其中，type=question 只能和 role=user 对应，即仅用户角色可以且只能发起 question 类型的消息。
展开全部
示例：question
question
content_type
消息内容的类型，content 不为空时，此参数为必选。支持设置为：
text：文本。
object_string：多模态内容，即文本和文件的组合、文本和图片的组合。
card：卡片。此枚举值仅在接口响应中出现，不支持作为入参。
content 不为空时，此参数为必选。
展开全部
示例：object_string
text
content
消息的内容，支持纯文本、多模态（文本、图片、文件混合输入）、卡片等多种类型的内容。
content_type 为 object_string 时，content 为 object_string object 数组序列化之后的 JSON String，详细说明可参考 object_string object。
当 content_type = text **** 时，content 为普通文本，例如 "content" :"Hello!"。
展开全部
示例：[{\"type\":\"text\",\"text\":\"你好我有一个帽衫，我想问问它好看么，你帮我看看\"},{\"type\":\"image\",\"file_id\":\"{{file_id_1}}\"},{\"type\":\"file\",\"file_id\":\"{{file_id_2}}\"},{\"type\":\"file\",\"file_url\":\"{{file_url_1}}\"}]
hello
meta_data
创建消息时的附加消息，查看消息列表时会返回此附加消息。
自定义键值对，应指定为 Map 对象格式。长度为 16 对键值对，其中键（key）的长度范围为 1～64 个字符，值（value）的长度范围为 1～512 个字符。
展开全部
示例：-
key_1
Enter value
custom_variables
智能体中定义的变量。在智能体 prompt 中设置变量 {{key}} 后，可以通过该参数传入变量值，同时支持 Jinja2 语法。详细说明可参考变量示例。
变量名只支持英文字母和下划线。
展开全部
示例：{ "language": "英文" }
key_1
Enter value
auto_save_history
是否保存本次对话记录。
true：（默认）会话中保存本次对话记录，包括 additional_messages 中指定的所有消息、本次对话的模型回复结果、模型执行中间结果。
false：会话中不保存本次对话记录，后续也无法通过任何方式查看本次对话信息、消息详情。在同一个会话中再次发起对话时，本次会话也不会作为上下文传递给模型。
非流式响应下（stream=false），此参数必须设置为 true，即保存本次对话记录，否则无法查看对话状态和模型回复。
调用端插件时，此参数必须设置为 true，即保存本次对话记录，否则提交工具执行结果时会提示 5000 错误，端插件的详细 API 使用示例请参见通过 API 使用端插件。
展开全部
示例：true
Please select
meta_data
附加信息，通常用于封装一些业务相关的字段。查看对话详情时，扣子会透传此附加信息，查看消息列表时不会返回该附加信息。
自定义键值对，应指定为 Map 对象格式。长度为 16 对键值对，其中键（key）的长度范围为 1～64 个字符，值（value）的长度范围为 1～512 个字符。
展开全部
示例：{ "uuid": "newid1234" }
key_1
Enter value
extra_params
附加参数，通常用于特殊场景下指定一些必要参数供模型判断，例如指定经纬度，并询问智能体此位置的天气。
自定义键值对格式，其中键（key）仅支持设置为：
latitude：纬度，此时值（Value）为纬度值，例如 39.9800718。
longitude：经度，此时值（Value）为经度值，例如 116.309314。
展开全部
示例：{"latitude":"39.9800718","longitude":"116.309314"}
key_1
Enter value
shortcut_command
command_id
指定对话要执行的快捷指令 ID，必须是智能体已绑定的快捷指令。
若对话无需执行快捷指令时，无需设置此参数。
你可以通过获取智能体配置接口中的ShortcutCommandInfo查看快捷指令 ID。
展开全部
示例：cmd_123456
Please enter command_id
parameters
用户输入的快捷指令组件参数信息。
自定义键值对，其中键（key）为快捷指令组件的名称，值（value）为组件对应的用户输入，为 object_string object 数组序列化之后的 JSON String，详细说明可参考 object_string object。
展开全部
示例：{"param1":"[{\"type\":\"text\",\"text\":\"参数值1\"}]","param2":"[{\"type\":\"text\",\"text\":\"参数值2\"}]"}
key_1
Enter value
parameters
给自定义参数赋值并传给对话流。你可以根据实际业务需求，在对话流开始节点的输入参数中设置自定义参数，调用本接口发起对话时，可以通过parameters 参数传入自定义参数的值并传给对话流。示例代码请参见为自定义参数赋值。
仅支持为已发布 API、ChatSDK 的单 Agent（对话流模式）的智能体设置该参数。
展开全部
示例：{"image": "{\"file_id\":\"1122334455\"}"}
{}
enable_card
设置问答节点返回的内容是否为卡片形式。默认为 false。
true：问答节点返回卡片形式的内容。
API 渠道暂时不支持直接渲染卡片交互形式。仅在 Chat SDK 中支持呈现智能体的卡片交互。
如果需要实现卡片内容展示，你可以在该 API 响应中获取卡片数据，在 Card SDK 的 runtimeOptions.dsl 中引用 API 返回的卡片 data 字段，通过 Card SDK 进行解析并将卡片数据转换为可视化界面，具体请参见安装并使用 Card SDK。
false：问答节点返回普通文本形式的内容。
展开全部
示例：true
Please select
publish_status
智能体的发布状态，用于指定与已发布版本的智能体对话还是和最新草稿版本的智能体对话。默认值为 published_online。枚举值：
published_online：已发布的线上版本。
unpublished_draft：草稿版本。
展开全部
示例：published_online
Please select
bot_version
指定智能体的版本号，用于与历史版本的智能体进行对话。默认与最新版本的智能体对话。
当 publish_status 设置为 unpublished_draft时，填写此参数会提示 4000 错误。
你可以通过查看智能体版本列表 API 查看智能体的版本号。
展开全部
示例：1756277832***

示例代码：
python:
"""
This example is about how to use the streaming interface to start a chat request
and handle chat events
"""

import os
# Our official coze sdk for Python [cozepy](https://github.com/coze-dev/coze-py)
from cozepy import COZE_CN_BASE_URL

# Get an access_token through personal access token or oauth.
coze_api_token = 'sat_JGKRG441iv59XIrx89x7rSYSliFoGHTqYbTg7RvY8L6ARd1napX0HO226Tbl7Sjj'
# The default access is api.coze.com, but if you need to access api.coze.cn,
# please use base_url to configure the api endpoint to access
coze_api_base = COZE_CN_BASE_URL

from cozepy import Coze, TokenAuth, Message, ChatStatus, MessageContentType, ChatEventType  # noqa

# Init the Coze client through the access_token.
coze = Coze(auth=TokenAuth(token=coze_api_token), base_url=coze_api_base)

# Create a bot instance in Coze, copy the last number from the web link as the bot's ID.
bot_id = '7630849074828525622'
# The user id identifies the identity of a user. Developers can use a custom business ID
# or a random string.
user_id = '123456789'

# Call the coze.chat.stream method to create a chat. The create method is a streaming
# chat and will return a Chat Iterator. Developers should iterate the iterator to get
# chat event and handle them.
for event in coze.chat.stream(
    bot_id=bot_id,
    user_id=user_id,
    additional_messages=[
        Message.build_user_question_text("Tell a 500-word story."),
    ],
):
    if event.event == ChatEventType.CONVERSATION_MESSAGE_DELTA:
        print(event.message.content, end="", flush=True)

    if event.event == ChatEventType.CONVERSATION_CHAT_COMPLETED:
        print()
        print("token usage:", event.chat.usage.token_count)


JS：
// Our official coze sdk for JavaScript [coze-js](https://github.com/coze-dev/coze-js)
import { CozeAPI } from '@coze/api';

const apiClient = new CozeAPI({
  token: 'sat_JGKRG441iv59XIrx89x7rSYSliFoGHTqYbTg7RvY8L6ARd1napX0HO226Tbl7Sjj',
  baseURL: 'https://api.coze.cn'
});
const res = await apiClient.chat.stream({
  bot_id: '7630849074828525622',
  user_id: '123456789',
  additional_messages: [
  {
    "content": "hello",
    "content_type": "text",
    "role": "user",
    "type": "question"
  }
],
});