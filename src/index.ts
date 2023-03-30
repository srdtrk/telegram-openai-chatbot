import { Configuration, OpenAIApi, ChatCompletionRequestMessage } from "openai";
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

// Configure Telegram
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN!, { polling: true });

bot.on("message", async (msg: Message) => {
  console.log(msg);
  const botUsername = process.env.TELEGRAM_BOT_USERNAME!;
  const chatId = msg.chat.id;
  const text = msg.text;
  const user = msg.from!;
  client.connect();

  if (!text) {
    if (msg.photo) {
      bot.sendMessage(
        chatId,
        "Sorry, I can't process images yet. Please send text."
      );
    }
    if (msg.location) {
      const userCollection = client.db("mydb").collection("telegram_user_data");
      const userData = await userCollection.updateOne(
        {
          userId: user.id,
        },
        {
          $set: {
            location: msg.location,
          },
        },
        { upsert: true }
      );
      console.log(userData);
      if (userData.acknowledged) {
        bot.sendMessage(
          chatId,
          `Your location has been updated @${user.username!}.`
        );
      }
    }
    return;
  }

  const isMentioned = text.includes(`@${botUsername}`);
  const isCommand = text.startsWith("/");

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
  await messageCollection.insertOne(messageData);

  // Exit if the message is not a mention
  if (msg.chat.type == "group" && !isMentioned) {
    return;
  }
  if (isCommand) {
    bot.sendMessage(
      chatId,
      "There are no commands yet. Please message me to chat."
    );
    return;
  }

  // Get the last 15 messages for the current chat
  let lastMessages: MessageDocument[] = await messageCollection
    .find<MessageDocument>({ chatId })
    .sort({ timestamp: -1 })
    .limit(15)
    .toArray();
  lastMessages = lastMessages.reverse();

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
