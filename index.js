// index.js
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

// Load environment variables from .env
dotenv.config();
const { MongoClient, ServerApiVersion } = require('mongodb');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());





const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.oo7po89.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        // await client.connect();

        const db = client.db("newspaperDB");

        const usersCollection = db.collection("users");
        const articlesCollection = db.collection("articles");
        const publishersCollection = db.collection("publishers");



        // User apis

        app.post('/users', async (req, res) => {
            try {
                const user = req.body;
                const query = { email: user.email };

                const existingUser = await usersCollection.findOne(query);

                if (existingUser) {
                    const lastLogin = new Date();
                    await usersCollection.updateOne(query, { $set: { lastLogin } });

                    return res.status(200).send({
                        message: 'User already exists — login time updated',
                        inserted: false,
                        lastLogin
                    });
                }

                user.createdAt = new Date();
                user.lastLogin = new Date();

                const result = await usersCollection.insertOne(user);
                res.status(201).send({
                    message: 'User added successfully',
                    inserted: true,
                    insertedId: result.insertedId,
                    lastLogin: user.lastLogin
                });

            } catch (error) {
                console.error('❌ Error in /users POST:', error.message);
                res.status(500).send({ message: 'Server error', error: error.message });
            }
        });


        // Publisher apis





        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);




// Test route
app.get('/', (req, res) => {
    res.send('📰 Newspaper server is running without MongoDB...');
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Server is running on http://localhost:${PORT}`);
});
