/* This code is just a mental implementation of prompt steering. */

import { tool, streamText, stepCountIs, generateText, type ModelMessage } from "ai";
import { z } from "zod/v4";

const dummyTool = tool({
  description: "A dummy tool",
  inputSchema: z.object({
    name: z.string(),
  }),
  execute: async ({ name }) => {
    return { result: `Hello, ${name}!` };
  },
});

const secondDummyTool = tool({
  description: "A second dummy tool",
  inputSchema: z.object({
    name: z.string(),
  }),
  execute: async ({ name }) => {
    return { result: `Hello, ${name}!` };
  },
})

const steeringFunction = async({messages}: {messages: ModelMessage[]}) => {
  const steerModel = await generateText({
    model: "anthropic/claude-sonnet-4-5",
    prompt: `Steer it accordingly: ${messages.map((message) => `${message.role}: ${message.content}`).join("\n")}`
  })
  return steerModel.text;
}

const stream = streamText({
  model: "anthropic/claude-sonnet-4-5",
  prompt: "What is the capital of France?",
  tools: { dummy: dummyTool, secondDummy: secondDummyTool },
  stopWhen: stepCountIs(100),
  prepareStep: async ({stepNumber, messages}) => {

    // Changing the active tools based on the step number and messages
    // Also changing the system prompt , lets say using another model to steer based on the messages
    const activeTools = stepNumber > 2 ? [] : ["dummy" as const, "secondDummy" as const];
    const steeringSystemPrompt = await steeringFunction({messages});
    
    return {
      system: steeringSystemPrompt,
      activeTools: activeTools,
    }
  },
});

const { messages } = await stream.response;

console.log(messages);