import { Configuration, OpenAIApi } from "openai";
import { ChatCompletionRequestMessage } from "openai";
import * as dotenv from "dotenv";
import TelegramBot from "node-telegram-bot-api";
import { Message } from "node-telegram-bot-api";
import { MongoClient, ServerApiVersion } from "mongodb";
import { MessageDocument, MessageData } from "./types";

dotenv.config();

// Configure OpenAI
const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

// Configure MongoDB
const uri = process.env.MONGODB_URI!;
const client = new MongoClient(uri, {
  serverApi: ServerApiVersion.v1,
});
client.connect();

// Configure Telegram
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN!, { polling: true });

bot.on("message", async (msg: Message) => {
  const chatId = msg.chat.id;
  const text = msg.text;
  const user = msg.from!;

  if (!text) {
    bot.sendMessage(chatId, "Error: No text provided.");
    return;
  }

  const messageCollection = client.db("mydb").collection("telegram_test");
  // Save the message to the database
  const messageData: MessageDocument = {
    chatId,
    messageId: msg.message_id,
    userId: user.id,
    role: "user",
    username: user.username,
    firstName: user.first_name,
    content: text,
    timestamp: new Date(msg.date * 1000),
  };

  // Get the last 10 messages for the current chat
  let lastMessages: MessageDocument[] = await messageCollection
    .find<MessageDocument>({ chatId })
    .sort({ timestamp: -1 })
    .limit(10)
    .toArray();
  lastMessages = lastMessages.reverse();
  await messageCollection.insertOne(messageData);
  lastMessages.push(messageData);

  try {
    const contextMessages: ChatCompletionRequestMessage[] = lastMessages.map(
      (m) => MessageData.fromDocument(m).toOpenAIRequestMessage()
    );
    contextMessages.unshift(MessageData.SYSTEM_PROMPT);
    console.log(contextMessages);
    const completion = await openai.createChatCompletion({
      model: "gpt-4",
      messages: contextMessages,
    });
    const reply = completion.data.choices[0].message!.content;

    let sentMessage = await bot.sendMessage(chatId, reply);
    const replyData: MessageDocument = {
      chatId,
      messageId: sentMessage.message_id,
      userId: sentMessage.from!.id,
      role: "assistant",
      username: undefined,
      firstName: undefined,
      content: reply,
      timestamp: new Date(sentMessage.date * 1000),
    };
    await messageCollection.insertOne(replyData);
  } catch (error) {
    console.error(error);
    bot.sendMessage(chatId, "Error: Could not process your request.");
  }
});
