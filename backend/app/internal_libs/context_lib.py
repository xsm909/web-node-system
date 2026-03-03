import contextvars

# Context variable to hold the current execution_id
execution_context = contextvars.ContextVar("execution_context", default=None)
