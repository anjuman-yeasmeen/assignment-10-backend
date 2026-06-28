const { MongoClient, ServerApiVersion } = require("mongodb");

const uri = process.env.MONGO_URI;
const dbName = process.env.MONGO_DB || "medicare";

if (!uri) {
  throw new Error("MONGO_URI is not set. Check your .env file.");
}

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

let db;

// Connect once at startup and reuse the same client/db across requests.
async function connectDB() {
  if (db) return db;
  await client.connect();
  db = client.db(dbName);
  // Ping to confirm the connection is live before the server accepts traffic.
  await db.command({ ping: 1 });
  console.log(`MongoDB connected → db "${dbName}"`);
  return db;
}

// Named collection accessors so route code never hardcodes collection strings.
const collections = {
  users: () => db.collection("users"),
  doctors: () => db.collection("doctors"),
  appointments: () => db.collection("appointments"),
  reviews: () => db.collection("reviews"),
  payments: () => db.collection("payments"),
  prescriptions: () => db.collection("prescriptions"),
};

module.exports = { connectDB, collections, client };
