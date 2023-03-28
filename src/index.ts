import { Configuration, OpenAIApi } from "openai";
import { ChatCompletionRequestMessage } from "openai";
import * as dotenv from "dotenv";
import TelegramBot from "node-telegram-bot-api";
import { Message } from "node-telegram-bot-api";

dotenv.config();

// Configure OpenAI
const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

// Configure Telegram
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN!, { polling: true });

bot.on("message", async (msg: Message) => {
  const chatId = msg.chat.id;
  const text = msg.text;
  const user = msg.from?.first_name;
  let content;
  if (user) {
    content = `${user}: ${text!}`;
  } else {
    content = text!;
  }

  try {
    const userMessages: ChatCompletionRequestMessage[] = [
      {
        role: "user",
        content,
      },
    ];
    const completion = await openai.createChatCompletion({
      model: "gpt-3.5-turbo",
      messages: userMessages,
    });
    const reply = completion.data.choices[0].message!.content;

    bot.sendMessage(chatId, reply);
  } catch (error) {
    console.error(error);
    bot.sendMessage(chatId, "Error: Could not process your request.");
  }
});
