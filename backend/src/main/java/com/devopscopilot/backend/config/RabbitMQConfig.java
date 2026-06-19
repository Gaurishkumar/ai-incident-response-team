package com.devopscopilot.backend.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.springframework.amqp.core.*;
import org.springframework.amqp.rabbit.config.SimpleRabbitListenerContainerFactory;
import org.springframework.amqp.rabbit.connection.ConnectionFactory;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.amqp.support.converter.Jackson2JsonMessageConverter;
import org.springframework.amqp.support.converter.MessageConverter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class RabbitMQConfig {

    // ---- Exchange names ----
    public static final String ANALYSIS_EXCHANGE  = "incident.analysis.exchange";
    public static final String RESULTS_EXCHANGE   = "incident.results.exchange";
    public static final String DLQ_EXCHANGE       = "incident.dlq.exchange";

    // ---- Queue names ----
    public static final String ANALYSIS_QUEUE     = "incident.analysis.queue";
    public static final String RESULTS_QUEUE      = "incident.results.queue";
    public static final String DLQ_QUEUE          = "incident.dlq";

    // ---- Routing keys ----
    public static final String ANALYSIS_ROUTING_KEY = "incident.analysis";
    public static final String RESULTS_ROUTING_KEY  = "incident.results";
    public static final String DLQ_ROUTING_KEY      = "incident.dlq";

    // ---- DLQ ----
    @Bean
    public DirectExchange dlqExchange() {
        return ExchangeBuilder.directExchange(DLQ_EXCHANGE).durable(true).build();
    }

    @Bean
    public Queue dlqQueue() {
        return QueueBuilder.durable(DLQ_QUEUE).build();
    }

    @Bean
    public Binding dlqBinding() {
        return BindingBuilder.bind(dlqQueue()).to(dlqExchange()).with(DLQ_ROUTING_KEY);
    }

    // ---- Analysis exchange + queue ----
    @Bean
    public DirectExchange analysisExchange() {
        return ExchangeBuilder.directExchange(ANALYSIS_EXCHANGE).durable(true).build();
    }

    @Bean
    public Queue analysisQueue() {
        return QueueBuilder.durable(ANALYSIS_QUEUE)
            .withArgument("x-dead-letter-exchange", DLQ_EXCHANGE)
            .withArgument("x-dead-letter-routing-key", DLQ_ROUTING_KEY)
            .withArgument("x-message-ttl", 1_800_000L)
            .build();
    }

    @Bean
    public Binding analysisBinding() {
        return BindingBuilder.bind(analysisQueue()).to(analysisExchange()).with(ANALYSIS_ROUTING_KEY);
    }

    // ---- Results exchange + queue ----
    @Bean
    public DirectExchange resultsExchange() {
        return ExchangeBuilder.directExchange(RESULTS_EXCHANGE).durable(true).build();
    }

    @Bean
    public Queue resultsQueue() {
        return QueueBuilder.durable(RESULTS_QUEUE).build();
    }

    @Bean
    public Binding resultsBinding() {
        return BindingBuilder.bind(resultsQueue()).to(resultsExchange()).with(RESULTS_ROUTING_KEY);
    }

    // ---- Message converter (snake_case for FastAPI compatibility) ----
    @Bean
    public MessageConverter messageConverter() {
        ObjectMapper mapper = new ObjectMapper()
            .registerModule(new JavaTimeModule())
            .setPropertyNamingStrategy(PropertyNamingStrategies.SNAKE_CASE);
        return new Jackson2JsonMessageConverter(mapper);
    }

    @Bean
    public RabbitTemplate rabbitTemplate(ConnectionFactory connectionFactory) {
        RabbitTemplate template = new RabbitTemplate(connectionFactory);
        template.setMessageConverter(messageConverter());
        return template;
    }

    @Bean
    public SimpleRabbitListenerContainerFactory rabbitListenerContainerFactory(
            ConnectionFactory connectionFactory) {
        SimpleRabbitListenerContainerFactory factory = new SimpleRabbitListenerContainerFactory();
        factory.setConnectionFactory(connectionFactory);
        factory.setMessageConverter(messageConverter());
        factory.setAcknowledgeMode(org.springframework.amqp.core.AcknowledgeMode.MANUAL);
        factory.setPrefetchCount(1);
        return factory;
    }
}
