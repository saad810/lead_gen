import mongoose from "mongoose";

declare global {
  // eslint-disable-next-line no-var
  var _mongooseConnection: Promise<typeof mongoose> | undefined;
}

const MONGODB_URI = process.env.MONGO_URI || "mongodb+srv://admin:admin@cluster0.cwcv5tj.mongodb.net";

const connectMongo = async () => {
  if (!global._mongooseConnection) {
    global._mongooseConnection = mongoose.connect(MONGODB_URI);
  }
  return global._mongooseConnection;
};

export default connectMongo;
