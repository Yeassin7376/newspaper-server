// index.js
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

// Load environment variables from .env
dotenv.config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

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

        // ✅ Create unique index on publisher name
        await publishersCollection.createIndex({ name: 1 }, { unique: true });




        // User apis

        app.post('/users', async (req, res) => {
            try {
                const user = req.body;
                const query = { email: user.email };

                const existingUser = await usersCollection.findOne(query);

                if (existingUser) {
                    const last_login = new Date();
                    await usersCollection.updateOne(query, { $set: { last_login } });

                    return res.status(200).send({
                        message: 'User already exists — login time updated',
                        inserted: false,
                        last_login
                    });
                }

                const result = await usersCollection.insertOne(user);
                res.status(201).send({
                    message: 'User added successfully',
                    inserted: true,
                    insertedId: result.insertedId,
                    last_login: user.last_login
                });

            } catch (error) {
                console.error('❌ Error in /users POST:', error.message);
                res.status(500).send({ message: 'Server error', error: error.message });
            }
        });

        // get user by role and all users
        app.get('/users', async (req, res) => {
            try {
                const role = req.query.role;
                const page = parseInt(req.query.page) || 1;
                const limit = parseInt(req.query.limit) || 10;
                const skip = (page - 1) * limit;

                let query = {};
                if (role) {
                    query = { role: role.toLowerCase() };
                }

                // Total count of users matching query
                const total = await usersCollection.countDocuments(query);

                // Fetch paginated users
                const users = await usersCollection
                    .find(query)
                    .skip(skip)
                    .limit(limit)
                    .toArray();

                res.status(200).send({
                    users,            // The current page of users
                    total,            // 🔁 Renamed from 'count' to 'total'
                    totalPages: Math.ceil(total / limit), // Optional for frontend UI
                    currentPage: page                      // Optional, but nice to have
                });

            } catch (error) {
                console.error('❌ Error fetching paginated users:', error.message);
                res.status(500).send({ message: 'Server error', error: error.message });
            }
        });


        // update user role

        app.patch('/users/:id', async (req, res) => {
            try {
                const id = req.params.id;
                const newRole = req.body.role;

                if (!newRole) {
                    return res.status(400).send({ message: 'Role is required' });
                }

                const filter = { _id: new ObjectId(id) };
                const update = {
                    $set: { role: newRole.toLowerCase() }
                };

                const result = await usersCollection.updateOne(filter, update);

                if (result.modifiedCount === 0) {
                    return res.status(404).send({ message: 'User not found or role is unchanged' });
                }

                res.status(200).send({ message: 'User role updated successfully', modifiedCount: result.modifiedCount });

            } catch (error) {
                console.error('❌ Error updating user role:', error.message);
                res.status(500).send({ message: 'Server error', error: error.message });
            }
        });






        // Publisher apis
        app.get('/publishers', async (req, res) => {
            try {
                const publishers = await publishersCollection.find().toArray();
                res.status(200).send(publishers);
            } catch (error) {
                console.error('❌ Error fetching publishers:', error.message);
                res.status(500).send({ message: 'Server error', error: error.message });
            }
        });


        app.post('/publishers', async (req, res) => {
            try {
                let { name, ...rest } = req.body;

                if (!name) {
                    return res.status(400).send({ message: 'Publisher name is required' });
                }

                const cleanName = name.trim().toLowerCase();

                const existing = await publishersCollection.findOne({ name: cleanName });

                if (existing) {
                    return res.status(200).send({ message: 'Publisher already exists', inserted: false });
                }

                const publisher = {
                    name: cleanName, // for matching and uniqueness
                    displayName: name, // for showing the real one
                    ...rest,
                    createdAt: new Date(),
                };

                const result = await publishersCollection.insertOne(publisher);

                res.status(201).send({
                    message: 'Publisher added successfully',
                    inserted: true,
                    insertedId: result.insertedId
                });

            } catch (error) {
                console.error('❌ Error adding publisher:', error.message);
                res.status(500).send({ message: 'Server error', error: error.message });
            }
        });




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
