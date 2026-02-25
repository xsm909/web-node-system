import contextvars

# Context variable to hold the logger function (e.g., WorkflowExecutor.log)
# It should accept (message: str, level: str)
executor_logger = contextvars.ContextVar("executor_logger", default=None)

def system_log(message: str, level: str = "info"):
    """
    Logs a message to the active WorkflowExecutor if one is present in the context.
    Otherwise, prints to standard output.
    """
    logger_fn = executor_logger.get()
    if logger_fn:
        try:
            logger_fn(message, level=level)
        except Exception as e:
            print(f"Error logging to executor: {e}")
            print(message, flush=True)
    else:
        print(message, flush=True)
