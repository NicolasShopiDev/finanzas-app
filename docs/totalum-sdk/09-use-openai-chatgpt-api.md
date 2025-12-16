## use-openai-chatgpt-api

Totalum allows you to use OpenAI's ChatGPT API without needing to register for an OpenAI account. You can use it directly through the Totalum SDK.

If user wants to use other llms, or a more heavy usage of OpenAI, instead of using the Totalum integrated OpenAI, use this package: https://www.npmjs.com/package/ai
(deep investigate on internet (https://ai-sdk.dev/) how this package works and then implement it, always mentioning to the user that they need to set their own api key depends of the llm they want to use).

Else, use the Totalum integrated OpenAI.


### Create a chat completion

**Use Case:**

Send messages to ChatGPT and get AI-generated responses. Useful for chatbots, content generation, question answering, and more.

Important think: use gpt-4.1-mini or gpt-4.1-2025-04-14 models.
use gpt-4.1-mini for faster and cheaper responses, gpt-4.1-2025-04-14 for more advanced capabilities.

```javascript

// Define the OpenAI chat completion body
// See OpenAI API docs for more details: https://platform.openai.com/docs/api-reference/chat/create
const chatBody = {
    messages: [
        {
            content: 'You are a helpful customer service assistant for an e-commerce platform',
            role: 'system'
        },
        {
            content: 'How do I track my order?',
            role: 'user'
        }
    ],
    model: 'gpt-4.1-mini', // or 'gpt-4.1-2025-04-14'
    max_tokens: 150, // optional: limit response length
    temperature: 0.7 // optional: controls randomness (0-2, default 1)
};

const result = await totalumSdk.openai.createChatCompletion(chatBody);
const chatCompletion = result.data;

// Extract the AI response
const aiResponse = chatCompletion.choices[0].message.content;
console.log('AI Response:', aiResponse);

```



### Important notes

- **No OpenAI account needed**: Totalum handles the OpenAI API integration, you don't need to register separately
- **Temperature**: Lower values (0-0.3) are more focused and deterministic, higher values (0.7-2.0) are more creative
- **Conversation context**: Include previous messages in the `messages` array to maintain conversation context only if needed
- **System messages**: Use system messages to set the behavior and personality of the AI assistant
