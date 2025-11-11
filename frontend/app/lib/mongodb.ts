import mongoose from "mongoose";

declare global {
  // eslint-disable-next-line no-var
  var _mongooseConnection: Promise<typeof mongoose> | undefined;
}

const MONGODB_URI = process.env.MONGO_URI;
//ignore if (!MONGODB_URI) {
//ignore   throw new Error("Please define the MONGO_URI environment variable");
//ignore }
const connectMongo = async () => {
  if (!global._mongooseConnection) {
    global._mongooseConnection = mongoose.connect(MONGODB_URI);
  }
  return global._mongooseConnection;
};

export default connectMongo;
