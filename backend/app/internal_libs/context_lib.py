import contextvars

# Context variable to hold the current execution_id
execution_context = contextvars.ContextVar("execution_context", default=None)

# Context variable to hold the current report parameters
report_params_context = contextvars.ContextVar("report_params_context", default=None)
