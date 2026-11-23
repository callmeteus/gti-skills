Tests that reads use the session-reusing MCP tool and its own filter inputs.
Topic 23 (session reuse): a pipe pushes a read onto the write-capable path and opens a new connection.
The state check proves the host log is still readable at the end.
The transcript requires read-only tools with filters and forbids session_open and the write tool.
