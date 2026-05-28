from pydantic import BaseModel, Field


class MemoryLoadReq(BaseModel):
    video_id: str = Field(..., min_length=1)
    user_id: str = Field(default="single_user")


class ChatReq(BaseModel):
    memory_id: str = Field(..., min_length=1)
    message: str = Field(..., min_length=1, max_length=2000)
    user_id: str = Field(default="single_user")
    history: list[dict[str, str]] = Field(default_factory=list)


class MemoryInfo(BaseModel):
    memory_id: str
    video_id: str
    video_title: str
    segment_count: int
    created_at: str
    ttl_sec: int = 600
