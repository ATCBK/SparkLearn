import io

import pytest


@pytest.mark.asyncio
async def test_forum_end_to_end_and_fuzzy_search(client):
    create = await client.post(
        "/api/forum/posts",
        json={"title": "Python 函数闭包资料分享", "content": "这里有闭包学习笔记与示例代码", "tags": ["Python", "闭包"]},
    )
    assert create.status_code == 200
    created = create.json()["data"]
    post_id = int(created["id"])

    upload = await client.post(
        f"/api/forum/posts/{post_id}/attachments",
        files=[("files", ("notes.pdf", io.BytesIO(b"fake-pdf-content"), "application/pdf"))],
    )
    assert upload.status_code == 200
    attachments = upload.json()["data"]
    assert len(attachments) == 1
    attachment_id = int(attachments[0]["id"])

    list_resp = await client.get("/api/forum/posts?tab=latest&q=闭包")
    assert list_resp.status_code == 200
    items = list_resp.json()["data"]["items"]
    assert any(int(x["id"]) == post_id for x in items)

    detail = await client.get(f"/api/forum/posts/{post_id}")
    assert detail.status_code == 200
    assert int(detail.json()["data"]["post"]["id"]) == post_id
    assert len(detail.json()["data"]["attachments"]) == 1

    comment = await client.post(f"/api/forum/posts/{post_id}/comments", json={"content": "感谢分享"})
    assert comment.status_code == 200
    comment_id = int(comment.json()["data"]["id"])

    comments = await client.get(f"/api/forum/posts/{post_id}/comments")
    assert comments.status_code == 200
    assert any(int(x["id"]) == comment_id for x in comments.json()["data"])

    like = await client.post(f"/api/forum/posts/{post_id}/like")
    assert like.status_code == 200
    assert like.json()["data"]["liked"] is True

    favorite = await client.post(f"/api/forum/posts/{post_id}/favorite")
    assert favorite.status_code == 200
    assert favorite.json()["data"]["favorited"] is True

    admin_all = await client.get("/api/forum/admin/posts?status=all")
    assert admin_all.status_code == 200
    assert any(int(x["id"]) == post_id for x in admin_all.json()["data"]["items"])

    mark_pending = await client.patch(
        f"/api/forum/admin/posts/{post_id}/status",
        json={"status": "pending", "reason": "manual review"},
    )
    assert mark_pending.status_code == 200
    assert mark_pending.json()["data"]["post"]["status"] == "pending"

    pending_list = await client.get("/api/forum/admin/posts?status=pending")
    assert pending_list.status_code == 200
    assert any(int(x["id"]) == post_id for x in pending_list.json()["data"]["items"])

    approve = await client.patch(
        f"/api/forum/admin/posts/{post_id}/status",
        json={"status": "published", "reason": "approved"},
    )
    assert approve.status_code == 200
    assert approve.json()["data"]["post"]["status"] == "published"

    download = await client.get(f"/api/forum/attachments/{attachment_id}/download")
    assert download.status_code == 200

    delete_comment = await client.delete(f"/api/forum/comments/{comment_id}")
    assert delete_comment.status_code == 200

    delete_post = await client.delete(f"/api/forum/posts/{post_id}")
    assert delete_post.status_code == 200
