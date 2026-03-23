import contextvars

# Context variable to hold the current execution_id
execution_context = contextvars.ContextVar("execution_context", default=None)

# Context variable to hold the current object parameters
object_params_context = contextvars.ContextVar("object_params_context", default=None)

# Context variables for Project Mode
project_id_context = contextvars.ContextVar("project_id_context", default=None)
project_owner_context = contextvars.ContextVar("project_owner_context", default=None)
