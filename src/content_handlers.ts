import TelegramBot, { Message, User } from "node-telegram-bot-api";
import { MongoClient } from "mongodb";
import { UserDocument } from "./types";

// non-text content gets handled here
export async function handleContent(
  bot: TelegramBot,
  client: MongoClient,
  msg: Message,
  user: User,
  chatId: number
): Promise<void> {
  if (msg.photo) {
    await bot.sendMessage(
      chatId,
      "Sorry, I can't process images yet. Please send text."
    );
  }

  if (msg.location) {
    const userCollection = client
      .db("mydb")
      .collection<UserDocument>("telegram_user_data");
    const userData = await userCollection.updateOne(
      { userId: user.id },
      { $set: { location: msg.location } },
      { upsert: true }
    );

    if (userData.acknowledged) {
      await bot.sendMessage(
        chatId,
        `Your location has been updated @${user.username!}.`
      );
    }
  }
}
