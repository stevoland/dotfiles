import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-grpc";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { SimpleSpanProcessor } from "@opentelemetry/sdk-trace-base";

const processor = new SimpleSpanProcessor(new OTLPTraceExporter());
new NodeSDK({ spanProcessors: [processor] }).start();
