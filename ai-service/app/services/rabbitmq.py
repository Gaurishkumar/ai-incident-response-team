import asyncio
import json
import logging
from typing import Callable, Optional

import aio_pika
from aio_pika import DeliveryMode, ExchangeType, Message
from aio_pika.abc import AbstractIncomingMessage

from app.config import settings

logger = logging.getLogger(__name__)

_ANALYSIS_EXCHANGE = "incident.analysis.exchange"
_ANALYSIS_QUEUE = "incident.analysis.queue"
_ANALYSIS_ROUTING_KEY = "incident.analysis"

_RESULTS_EXCHANGE = "incident.results.exchange"
_RESULTS_QUEUE = "incident.results.queue"
_RESULTS_ROUTING_KEY = "incident.results"

_DLQ_EXCHANGE = "incident.dlq.exchange"
_DLQ_QUEUE = "incident.dlq"
_DLQ_ROUTING_KEY = "incident.dlq"


class RabbitMQService:
    def __init__(self):
        self._connection: Optional[aio_pika.RobustConnection] = None
        self._channel: Optional[aio_pika.Channel] = None
        self._results_exchange = None

    async def connect(self):
        self._connection = await aio_pika.connect_robust(
            settings.RABBITMQ_URL,
            reconnect_interval=5,
        )
        self._channel = await self._connection.channel()
        await self._channel.set_qos(prefetch_count=1)
        await self._declare_topology()
        logger.info("RabbitMQ connected — topology declared")

    async def _declare_topology(self):
        # DLQ must be declared before analysis queue references it
        dlq_exchange = await self._channel.declare_exchange(
            _DLQ_EXCHANGE, ExchangeType.DIRECT, durable=True
        )
        dlq_queue = await self._channel.declare_queue(_DLQ_QUEUE, durable=True)
        await dlq_queue.bind(dlq_exchange, routing_key=_DLQ_ROUTING_KEY)

        # Analysis exchange + queue with DLX and TTL
        await self._channel.declare_exchange(
            _ANALYSIS_EXCHANGE, ExchangeType.DIRECT, durable=True
        )
        analysis_queue = await self._channel.declare_queue(
            _ANALYSIS_QUEUE,
            durable=True,
            arguments={
                "x-dead-letter-exchange": _DLQ_EXCHANGE,
                "x-dead-letter-routing-key": _DLQ_ROUTING_KEY,
                "x-message-ttl": 1_800_000,  # 30 minutes in ms
            },
        )
        analysis_exchange = await self._channel.get_exchange(_ANALYSIS_EXCHANGE)
        await analysis_queue.bind(analysis_exchange, routing_key=_ANALYSIS_ROUTING_KEY)

        # Results exchange + queue
        self._results_exchange = await self._channel.declare_exchange(
            _RESULTS_EXCHANGE, ExchangeType.DIRECT, durable=True
        )
        results_queue = await self._channel.declare_queue(_RESULTS_QUEUE, durable=True)
        await results_queue.bind(self._results_exchange, routing_key=_RESULTS_ROUTING_KEY)

    async def start_consuming(self, callback: Callable):
        queue = await self._channel.get_queue(_ANALYSIS_QUEUE)
        await queue.consume(callback)
        logger.info(f"Consuming from {_ANALYSIS_QUEUE}")

    async def publish_result(self, result: dict) -> bool:
        if self._results_exchange is None:
            logger.error("Results exchange not initialized")
            return False

        for attempt in range(5):
            try:
                await self._results_exchange.publish(
                    Message(
                        body=json.dumps(result, default=str).encode(),
                        delivery_mode=DeliveryMode.PERSISTENT,
                        content_type="application/json",
                    ),
                    routing_key=_RESULTS_ROUTING_KEY,
                )
                return True
            except Exception as e:
                logger.error(f"Result publish attempt {attempt + 1}/5 failed: {e}")
                if attempt < 4:
                    await asyncio.sleep(2**attempt)

        return False

    async def check_health(self) -> bool:
        return (
            self._connection is not None
            and not self._connection.is_closed
        )

    async def close(self):
        if self._connection and not self._connection.is_closed:
            await self._connection.close()
            logger.info("RabbitMQ connection closed")


rabbitmq_service = RabbitMQService()
