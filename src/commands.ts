import { MongoClient } from "mongodb";
import TelegramBot, { User } from "node-telegram-bot-api";

export function handleCommand(
  bot: TelegramBot,
  client: MongoClient,
  text: string,
  user: User,
  chatId: number
): void {
  const command = text.split(" ")[0];

  switch (command) {
    case "/start":
      bot.sendMessage(
        chatId,
        `Hi @${user.username}! I'm a chatbot that uses GPT-4 to generate replies. Please message me to chat.`
      );
      break;
    case "/help":
      bot.sendMessage(
        chatId,
        `Hi @${user.username}! I'm a chatbot that uses GPT-4 to generate replies. Please message me to chat.`
      );
      break;
    case "/reset":
      const messageCollection = client.db("mydb").collection("telegram_test");
      messageCollection.deleteMany({ chatId });
      const userCollection = client.db("mydb").collection("telegram_user_data");
      userCollection.deleteOne({ userId: user.id });
      bot.sendMessage(
        chatId,
        "This thread has been reset. Please message me to chat."
      );
      break;
    default:
      bot.sendMessage(
        chatId,
        `Sorry, I don't understand that command. Please message me to chat.`
      );
      break;
  }
}
