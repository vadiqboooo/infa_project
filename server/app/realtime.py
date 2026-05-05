"""Small in-process realtime hub for task solution comment updates."""

from collections import defaultdict
from typing import Any

from fastapi import WebSocket


class SolutionCommentConnectionManager:
    def __init__(self) -> None:
        self._connections: dict[tuple[int, int], set[WebSocket]] = defaultdict(set)

    async def connect(self, user_id: int, task_id: int, websocket: WebSocket) -> None:
        await websocket.accept()
        self._connections[(user_id, task_id)].add(websocket)

    def disconnect(self, user_id: int, task_id: int, websocket: WebSocket) -> None:
        key = (user_id, task_id)
        self._connections[key].discard(websocket)
        if not self._connections[key]:
            self._connections.pop(key, None)

    async def broadcast(self, user_id: int, task_id: int, payload: dict[str, Any]) -> None:
        key = (user_id, task_id)
        dead: list[WebSocket] = []
        for websocket in list(self._connections.get(key, ())):
            try:
                await websocket.send_json(payload)
            except Exception:
                dead.append(websocket)
        for websocket in dead:
            self.disconnect(user_id, task_id, websocket)


solution_comment_ws_manager = SolutionCommentConnectionManager()
