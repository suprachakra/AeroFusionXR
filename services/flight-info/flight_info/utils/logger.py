import logging
import sys
from typing import Any, Dict, Optional

import structlog
from structlog.types import EventDict, Processor


def add_log_level(
    logger: logging.Logger, method_name: str, event_dict: EventDict
) -> EventDict:
    """Add log level to structured log output."""
    event_dict["level"] = method_name
    return event_dict


def add_timestamp(
    logger: logging.Logger, method_name: str, event_dict: EventDict
) -> EventDict:
    """Add ISO format timestamp to structured log output."""
    event_dict["@timestamp"] = structlog.processors.TimeStamper(fmt="iso")(
        logger, method_name, event_dict
    )["@timestamp"]
    return event_dict


def add_caller_info(
    logger: logging.Logger, method_name: str, event_dict: EventDict
) -> EventDict:
    """Add caller information to structured log output."""
    frame = structlog._frames._find_first_app_frame_and_name()[0]
    event_dict.update(
        {
            "file": frame.f_code.co_filename,
            "line": frame.f_lineno,
            "function": frame.f_code.co_name,
        }
    )
    return event_dict


def setup_logging(
    service_name: str,
    log_level: str = "INFO",
    json_format: bool = True,
    extra_processors: Optional[list[Processor]] = None,
) -> None:
    """Configure structured logging."""
    processors = [
        structlog.stdlib.add_log_level,
        structlog.stdlib.add_logger_name,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        add_caller_info,
    ]

    if extra_processors:
        processors.extend(extra_processors)

    if json_format:
        processors.append(structlog.processors.JSONRenderer())
    else:
        processors.append(
            structlog.dev.ConsoleRenderer(colors=True, exception_formatter=structlog.dev.plain_traceback)
        )

    structlog.configure(
        processors=processors,
        context_class=dict,
        logger_factory=structlog.stdlib.LoggerFactory(),
        wrapper_class=structlog.stdlib.BoundLogger,
        cache_logger_on_first_use=True,
    )

    # Set up stdlib logging
    logging.basicConfig(
        format="%(message)s",
        stream=sys.stdout,
        level=getattr(logging, log_level.upper()),
    )

    # Add service name to all logs
    structlog.contextvars.clear_contextvars()
    structlog.contextvars.bind_contextvars(service=service_name)


class Logger:
    def __init__(self, context: Optional[Dict[str, Any]] = None):
        self.logger = structlog.get_logger()
        self.context = context or {}

    def bind(self, **kwargs: Any) -> "Logger":
        """Create a new logger with additional context."""
        new_context = {**self.context, **kwargs}
        return Logger(new_context)

    def _log(self, level: str, event: str, **kwargs: Any) -> None:
        """Log a message with context."""
        log_method = getattr(self.logger, level)
        log_method(event, **{**self.context, **kwargs})

    def debug(self, event: str, **kwargs: Any) -> None:
        """Log a debug message."""
        self._log("debug", event, **kwargs)

    def info(self, event: str, **kwargs: Any) -> None:
        """Log an info message."""
        self._log("info", event, **kwargs)

    def warning(self, event: str, **kwargs: Any) -> None:
        """Log a warning message."""
        self._log("warning", event, **kwargs)

    def error(self, event: str, **kwargs: Any) -> None:
        """Log an error message."""
        self._log("error", event, **kwargs)

    def critical(self, event: str, **kwargs: Any) -> None:
        """Log a critical message."""
        self._log("critical", event, **kwargs)

    def exception(self, event: str, **kwargs: Any) -> None:
        """Log an exception with traceback."""
        self._log("exception", event, **kwargs)


def get_request_logger() -> Logger:
    """Get a logger for HTTP requests."""
    return Logger().bind(component="http")


def get_service_logger(service_name: str) -> Logger:
    """Get a logger for a specific service."""
    return Logger().bind(component=service_name)


def get_task_logger(task_name: str) -> Logger:
    """Get a logger for a background task."""
    return Logger().bind(component="task", task=task_name) 