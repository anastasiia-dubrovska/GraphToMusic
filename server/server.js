const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { MongoClient, ObjectId } = require('mongodb');
const bcrypt = require('bcrypt');

const app = express();

app.use(cors());

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
const path = require('path');

app.use(express.static(path.join(__dirname, '../client')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/index.html'));
});

const uri = 'mongodb://localhost:27017/';
const client = new MongoClient(uri);
const secret = 'your_jwt_secret';
const saltRounds = 10;
let db;

async function connectToDatabase() {
    try {
        await client.connect();
        console.log('✅ Connected to MongoDB');
        return client.db('GraphToMusic');
    } catch (error) {
        console.error('❌ MongoDB connection error:', error);
        process.exit(1);
    }
}

function authenticateToken(req, res, next) {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ success: false, message: 'Токен відсутній' });

    try {
        const decoded = jwt.verify(token, secret);
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ success: false, message: 'Недійсний токен' });
    }
}

(async () => {
    db = await connectToDatabase();
    const usersCollection = db.collection('users');
    const compositionsCollection = db.collection('compositions');


    app.post('/api/auth/register', async (req, res) => {
        const { email, password } = req.body;
        try {
            const existingUser = await usersCollection.findOne({ email });
            if (existingUser) {
                return res.json({ success: false, message: 'Користувач уже існує' });
            }

            const hashedPassword = await bcrypt.hash(password, saltRounds);
            await usersCollection.insertOne({ email, password: hashedPassword });

            res.json({ success: true });
        } catch (error) {
            console.error('Register error:', error);
            res.status(500).json({ success: false, message: 'Помилка сервера' });
        }
    });

    app.post('/api/auth/login', async (req, res) => {
        const { email, password } = req.body;
        try {
            const user = await usersCollection.findOne({ email });
            if (!user) return res.json({ success: false, message: 'Невірний email або пароль' });

            const match = await bcrypt.compare(password, user.password);
            if (!match) return res.json({ success: false, message: 'Невірний email або пароль' });

            const token = jwt.sign({ email: user.email, id: user._id.toString() }, secret);
            res.json({ success: true, token, user: { email: user.email } });
        } catch (error) {
            console.error('Login error:', error);
            res.status(500).json({ success: false, message: 'Помилка сервера' });
        }
    });

    app.get('/api/auth/verify', authenticateToken, (req, res) => {
        res.json({ success: true });
    });


    app.post('/api/music/save', authenticateToken, async (req, res) => {
    const { title, function: func, settings } = req.body;
    try {
        await compositionsCollection.insertOne({
            userId: req.user.id,
            title: title || 'Untitled Composition',
            function: func,
            settings: settings || {},
            createdAt: new Date()
        });
        res.json({ success: true });
    } catch (error) {
        console.error('Save error:', error);
        res.status(500).json({ success: false, message: 'Помилка сервера' });
    }});

    app.get('/api/music/user', authenticateToken, async (req, res) => {
        try {
            const compositions = await compositionsCollection
                .find({ userId: req.user.id })
                .toArray();

            const formatted = compositions.map(comp => ({
                id: comp._id.toString(),
                title: comp.title,
                function: comp.function,
                settings: comp.settings || {},
                created_at: comp.createdAt.toISOString()
            }));

            res.json({ success: true, compositions: formatted });
        } catch (error) {
            console.error('Fetch compositions error:', error);
            res.status(500).json({ success: false, message: 'Помилка сервера' });
        }
    });

    app.delete('/api/music/:id', authenticateToken, async (req, res) => {
        const compositionId = req.params.id;

        if (!ObjectId.isValid(compositionId)) {
            return res.status(400).json({ success: false, message: 'Невірний ID композиції' });
        }

        try {
            const result = await compositionsCollection.deleteOne({
                _id: new ObjectId(compositionId),
                userId: req.user.id
            });

            if (result.deletedCount === 0) {
                return res.status(404).json({ success: false, message: 'Композицію не знайдено або неавторизовано' });
            }

            res.json({ success: true });
        } catch (error) {
            console.error('Delete error:', error);
            res.status(500).json({ success: false, message: 'Помилка сервера' });
        }
    });


    app.put('/api/auth/profile', authenticateToken, async (req, res) => {
        const { name } = req.body;
        try {
            await usersCollection.updateOne(
                { _id: new ObjectId(req.user.id) },
                { $set: { name } }
            );

            const user = await usersCollection.findOne({ _id: new ObjectId(req.user.id) });
            res.json({ success: true, user: { email: user.email, name: user.name } });
        } catch (error) {
            console.error('Update profile error:', error);
            res.status(500).json({ success: false, message: 'Помилка сервера' });
        }
    });

    app.put('/api/auth/change-password', authenticateToken, async (req, res) => {
        const { oldPassword, newPassword } = req.body;
        try {
            const user = await usersCollection.findOne({ _id: new ObjectId(req.user.id) });
            if (!user) return res.status(404).json({ success: false, message: 'Користувача не знайдено' });

            const match = await bcrypt.compare(oldPassword, user.password);
            if (!match) return res.status(400).json({ success: false, message: 'Невірний поточний пароль' });

            const hashedPassword = await bcrypt.hash(newPassword, saltRounds);
            await usersCollection.updateOne(
                { _id: new ObjectId(req.user.id) },
                { $set: { password: hashedPassword } }
            );
            res.json({ success: true });
        } catch (error) {
            console.error('Change password error:', error);
            res.status(500).json({ success: false, message: 'Помилка сервера' });
        }
    });


    app.post('/api/feedback', authenticateToken, async (req, res) => {
        const { rating, comment } = req.body;
        try {
            const feedbackCollection = db.collection('feedback');
            await feedbackCollection.insertOne({
                userId: req.user.id,
                email: req.user.email,
                rating,
                comment,
                createdAt: new Date()
            });
            res.json({ success: true });
        } catch (error) {
            console.error('Feedback error:', error);
            res.status(500).json({ success: false, message: 'Помилка сервера' });
        }
    });


    app.listen(3000, () => console.log('Server running on http://localhost:3000'));
})();


process.on('SIGINT', async () => {
    try {
        await client.close();
        console.log('MongoDB connection closed');
        process.exit(0);
    } catch (error) {
        console.error('Error closing MongoDB connection:', error);
        process.exit(1);
    }
});
