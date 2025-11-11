import mongoose from "mongoose";

declare global {
  // eslint-disable-next-line no-var
  var _mongooseConnection: Promise<typeof mongoose> | undefined;
}

const MONGODB_URI = process.env.MONGO_URI;

const connectMongo = async () => {
  if (!global._mongooseConnection) {
    if (!MONGODB_URI) {
      throw new Error("MONGO_URI environment variable is not set");
    }
    global._mongooseConnection = mongoose.connect(MONGODB_URI);
  }
  return global._mongooseConnection;
};

export default connectMongo;
