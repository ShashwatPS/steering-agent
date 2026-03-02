import {
  streamText,
  wrapLanguageModel,
  Output,
  stepCountIs,
  type LanguageModelMiddleware,
} from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { z } from "zod/v4";

/* This code is also a mental of steering , when our output is not as expected we can use guardrails to steer the model to produce the expected output. */

const guardrailMiddleware: LanguageModelMiddleware = {
  specificationVersion: "v3",

  async wrapGenerate({ doGenerate }) {
    const result = await doGenerate();

    const redactedContent = result.content.map((part) => {
      if (part.type === "text") {
        // A custom logic can be implemented here
        return { ...part, text: part.text };
      }
      return part;
    });

    console.log("[guardrail-middleware] wrapGenerate: validated output");
    return { ...result, content: redactedContent };
  },

  async wrapStream({ doStream }) {
    const { stream, ...rest } = await doStream();

    const transformedStream = stream.pipeThrough(
      new TransformStream({
        transform(chunk, controller) {
          if (chunk.type === "text-delta") {
            // Custom logic can be implemented here
            controller.enqueue({
              ...chunk,
              delta: chunk.delta,
            });
          } else {
            controller.enqueue(chunk);
          }
        },
      }),
    );

    console.log("[guardrail-middleware] wrapStream: attached stream filter");
    return { ...rest, stream: transformedStream };
  },
};

const guardRailModel = wrapLanguageModel({
  model: anthropic("claude-sonnet-4-5"),
  middleware: guardrailMiddleware,
});

const AnalysisSchema = z.object({
  summary: z.string().describe("A concise summary of the analysis"),
  keyPoints: z.array(z.string()).describe("Key points extracted"),
  sentiment: z.enum(["positive", "negative", "neutral"]).describe("Overall sentiment"),
  confidence: z.number().min(0).max(1).describe("Confidence score between 0 and 1"),
});

const stream = streamText({
  model: guardRailModel,
  prompt:
    "Analyze the following product review and provide a structured analysis:\n\n" +
    '"I absolutely love this new laptop! The battery life is incredible, lasting over 12 hours. ' +
    "The keyboard feels great and the screen is vibrant. My only complaint is that it runs a bit " +
    'warm under heavy load. Overall, best purchase I\'ve made this year."',
  stopWhen: stepCountIs(3),
  output: Output.object({ schema: AnalysisSchema }),
});

const [output, { messages }] = await Promise.all([
  stream.output,
  stream.response,
]);


for (const msg of messages) {
  console.log(msg.content);
}
