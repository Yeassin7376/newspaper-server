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

        // get user role by email
        app.get('/users/role', async (req, res) => {
            try {
                const email = req.query.email;

                if (!email) {
                    return res.status(400).send({ error: 'Email is required' });
                }

                const user = await usersCollection.findOne({ email });

                if (!user) {
                    return res.status(404).send({ error: 'User not found' });
                }

                res.send({ role: user.role || 'user' }); // Default role fallback
            } catch (error) {
                console.error("Error fetching user role:", error);
                res.status(500).send({ error: 'Failed to get user role' });
            }
        });

        app.get('/users/stats', async (req, res) => {
            try {
                const total = await usersCollection.estimatedDocumentCount();

                const normalCount = await usersCollection.countDocuments({ role: { $in: [null, 'user'] } });
                const premiumCount = await usersCollection.countDocuments({ role: 'premium' });

                res.send({
                    total,
                    normal: normalCount,
                    premium: premiumCount
                });
            } catch (error) {
                res.status(500).send({ message: 'Server error', error: error.message });
            }
        });

        app.patch('/users/:email', async (req, res) => {
            try {
              const email = req.params.email.toLowerCase().trim();
              const { name, photoURL } = req.body;
          
              if (!name && !photoURL) {
                return res.status(400).send({ message: 'Nothing to update' });
              }
          
              const filter = { email };
              const updateFields = {};
          
              if (name) updateFields.name = name.trim();
              if (photoURL) updateFields.photoURL = photoURL.trim();
          
              const updateDoc = {
                $set: {
                  ...updateFields,
                  updated_at: new Date()
                }
              };
          
              const result = await usersCollection.updateOne(filter, updateDoc);
          
              if (result.matchedCount === 0) {
                return res.status(404).send({ message: 'User not found' });
              }
          
              res.send({ message: 'User profile updated successfully', modifiedCount: result.modifiedCount });
            } catch (error) {
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

        // Articles APIs
        app.get('/articles', async (req, res) => {
            try {
                const page = parseInt(req.query.page) || 1; // Default page = 1
                const limit = parseInt(req.query.limit) || 10; // Default limit = 10
                const skip = (page - 1) * limit;

                const cursor = articlesCollection.find().skip(skip).limit(limit);

                const total = await articlesCollection.estimatedDocumentCount();
                const articles = await cursor.toArray();

                res.status(200).send({
                    page,
                    limit,
                    totalPages: Math.ceil(total / limit),
                    totalArticles: total,
                    articles
                });
            } catch (error) {
                console.error(' Error fetching paginated articles:', error.message);
                res.status(500).send({ message: 'Server error', error: error.message });
            }
        });

        // Get all articles created by the logged-in user
        app.get('/articles/user', async (req, res) => {
            try {
                const email = req.query.email;

                const articles = await articlesCollection
                    .find({ authorEmail: email })
                    .sort({ created_at: -1 })
                    .toArray();

                res.json(articles);
            } catch (error) {
                console.error('Error fetching user articles:', error);
                res.status(500).json({ error: 'Internal Server Error' });
            }
        });


        // GET /articles/approved
        app.get('/articles/approved', async (req, res) => {
            const { search = '', publisher = '', tags = '' } = req.query;

            const query = {
                status: 'approved'
            };

            if (search) {
                query.title = { $regex: search, $options: 'i' };
            }

            if (publisher) {
                query.publisher = publisher;
            }

            if (tags) {
                const tagArray = tags.split(',');
                query.tags = { $in: tagArray };
            }

            const articles = await articlesCollection.find(query).toArray();
            res.send(articles);
        });

        app.get('/articles/trending', async (req, res) => {
            try {
                const limit = parseInt(req.query.limit) || 6;

                const trendingArticles = await articlesCollection
                    .find({ status: 'approved' })    // Only approved articles
                    .sort({ views: -1 })             // Sort by highest views
                    .limit(limit)
                    .toArray();

                res.send(trendingArticles);
            } catch (error) {
                res.status(500).send({ message: 'Server error', error: error.message });
            }
        });

        // single article by id
        app.get('/articles/:id', async (req, res) => {
            try {
                const id = req.params.id;

                const article = await articlesCollection.findOne({ _id: new ObjectId(id) });

                if (!article) {
                    return res.status(404).send({ message: 'Article not found' });
                }
                const publisher = await publishersCollection.findOne({ name: article.publisher });

                article.publisherLogo = publisher.logoUrl;

                res.send(article);
            } catch (error) {
                console.error('❌ Error fetching article:', error.message);
                res.status(500).send({ message: 'Server error', error: error.message });
            }
        });


        app.patch('/articles/views/:id', async (req, res) => {
            try {
                const id = req.params.id;

                const result = await articlesCollection.updateOne(
                    { _id: new ObjectId(id) },
                    { $inc: { views: 1 } }
                );

                if (result.modifiedCount === 0) {
                    return res.status(404).send({ message: 'Article not found or view not updated' });
                }

                res.send({ message: 'View count incremented', result });
            } catch (error) {
                console.error('❌ Error updating views:', error.message);
                res.status(500).send({ message: 'Server error', error: error.message });
            }
        });



        app.post('/articles', async (req, res) => {
            try {
                const article = req.body;

                // Basic validation (add more fields as needed)
                if (!article.title || !article.description || !article.authorEmail) {
                    return res.status(400).send({ message: 'Title, content, and authorEmail are required' });
                }

                article.title = article.title.trim();
                article.description = article.description.trim();
                article.authorEmail = article.authorEmail.toLowerCase().trim();

                const result = await articlesCollection.insertOne(article);

                res.status(201).send({
                    message: 'Article created successfully',
                    inserted: true,
                    insertedId: result.insertedId
                });
            } catch (error) {
                console.error(' Error saving article:', error.message);
                res.status(500).send({ message: 'Server error', error: error.message });
            }
        });

        app.patch('/articles/approve/:id', async (req, res) => {
            try {
                const id = req.params.id;
                const result = await articlesCollection.updateOne(
                    { _id: new ObjectId(id) },
                    {
                        $set: {
                            status: 'approved',
                            reviewed_at: new Date(),
                            views: 0,
                        }
                    }
                );
                res.send({ message: 'Article approved', result });
            } catch (error) {
                console.error(' Error approving article:', error.message);
                res.status(500).send({ message: 'Server error', error: error.message });
            }
        });

        app.patch('/articles/decline/:id', async (req, res) => {
            try {
                const id = req.params.id;
                const { reason } = req.body;

                if (!reason) {
                    return res.status(400).send({ message: 'Decline reason is required' });
                }

                const result = await articlesCollection.updateOne(
                    { _id: new ObjectId(id) },
                    {
                        $set: {
                            status: 'declined',
                            declineReason: reason,
                            reviewed_at: new Date()
                        }
                    }
                );

                res.send({ message: 'Article declined with reason', result });
            } catch (error) {
                console.error(' Error declining article:', error.message);
                res.status(500).send({ message: 'Server error', error: error.message });
            }
        });

        app.patch('/articles/premium/:id', async (req, res) => {
            try {
                const id = req.params.id;
                const { isPremium } = req.body;

                const result = await articlesCollection.updateOne(
                    { _id: new ObjectId(id) },
                    { $set: { isPremium: isPremium } }
                );

                res.send({ message: `Article marked as ${isPremium ? 'Premium' : 'Standard'}`, result });
            } catch (error) {
                console.error(' Error updating premium status:', error.message);
                res.status(500).send({ message: 'Server error', error: error.message });
            }
        });


        app.patch('/articles/:id', async (req, res) => {
            try {
                const articleId = req.params.id;
                const updates = req.body;

                const filter = { _id: new ObjectId(articleId) };

                // Sanitize fields
                if (updates.title) updates.title = updates.title.trim();
                if (updates.description) updates.description = updates.description.trim();
                if (updates.authorEmail) updates.authorEmail = updates.authorEmail.toLowerCase().trim();

                const updateDoc = {
                    $set: {
                        ...updates,
                    }
                };

                const result = await articlesCollection.updateOne(filter, updateDoc);

                if (result.matchedCount === 0) {
                    return res.status(404).send({ message: 'Article not found' });
                }

                res.send({ message: 'Article updated successfully', matchedCount: result.matchedCount });

            } catch (error) {
                res.status(500).send({ message: 'Server error', error: error.message });
            }
        });



        app.delete('/articles/:id', async (req, res) => {
            try {
                const id = req.params.id;

                const result = await articlesCollection.deleteOne({ _id: new ObjectId(id) });

                if (result.deletedCount === 0) {
                    return res.status(404).send({ message: 'Article not found' });
                }

                res.send({ message: 'Article deleted successfully', result });
            } catch (error) {
                console.error('❌ Error deleting article:', error.message);
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
