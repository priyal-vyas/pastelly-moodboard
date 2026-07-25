const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Create directories
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}
app.use('/uploads', express.static(uploadDir));
app.use(express.static(__dirname));

// Local database filepath
const dbFile = path.join(__dirname, 'db.json');

// Helper to read database
function readDB() {
  if (!fs.existsSync(dbFile)) {
    // Initial structure
    const initialData = { users: [], boards: [], cards: [], moods: [] };
    fs.writeFileSync(dbFile, JSON.stringify(initialData, null, 2));
    return initialData;
  }
  try {
    const data = fs.readFileSync(dbFile, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error("Failed to parse db.json, returning empty structure:", err.message);
    return { users: [], boards: [], cards: [], moods: [] };
  }
}

// Helper to write database
function writeDB(data) {
  try {
    fs.writeFileSync(dbFile, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("Failed to write to db.json:", err.message);
  }
}

// Memory cache for OTP verification
const otpCache = {};

// ==========================================
// AUTHENTICATION ROUTERS
// ==========================================

// Signup: Direct Registration
app.post('/api/auth/register', (req, res) => {
  const { name, email, password, avatar } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Please provide all details (name, email, password).' });
  }

  const db = readDB();
  const existing = db.users.find(u => u.email.toLowerCase() === email.toLowerCase());
  if (existing) {
    return res.status(400).json({ error: 'Email already registered.' });
  }

  const userId = `user-${Date.now()}`;
  const newUser = {
    id: userId,
    name: name,
    email: email.toLowerCase(),
    password: password, 
    avatar: avatar || `https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=50&q=80`
  };

  db.users.push(newUser);

  // Auto-create a default board for the user
  const defaultBoardId = `board-${Date.now()}`;
  const defaultBoard = {
    id: defaultBoardId,
    userId: userId,
    name: 'My Cozy Board 🌸',
    desc: 'Your first gravity-free board! Double click to add notes or drag local images to begin.',
    theme: '#FFB0B5',
    liked: false,
    likesCount: 0
  };
  db.boards.push(defaultBoard);

  writeDB(db);

  res.json({
    success: true,
    user: { id: newUser.id, name: newUser.name, email: newUser.email, avatar: newUser.avatar },
    defaultBoardId
  });
});

// User Login
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Missing email or password.' });
  }

  const db = readDB();
  const user = db.users.find(u => u.email.toLowerCase() === email.toLowerCase() && u.password === password);
  if (!user) {
    return res.status(400).json({ error: 'Invalid email or password.' });
  }

  // Find user's boards
  let userBoards = db.boards.filter(b => b.userId === user.id);
  
  if (userBoards.length === 0) {
    const defaultBoardId = `board-${Date.now()}`;
    const defaultBoard = {
      id: defaultBoardId,
      userId: user.id,
      name: 'My Mood Canvas',
      desc: 'Your gravity-free mood canvas!',
      theme: '#FFB0B5',
      liked: false,
      likesCount: 0
    };
    db.boards.push(defaultBoard);
    writeDB(db);
    userBoards = [defaultBoard];
  }

  res.json({
    success: true,
    user: { id: user.id, name: user.name, email: user.email, avatar: user.avatar },
    boards: userBoards
  });
});

// Google Login / Signup Callback
app.post('/api/auth/google-login', (req, res) => {
  const { name, email, avatar } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Missing email.' });
  }

  const db = readDB();
  let user = db.users.find(u => u.email.toLowerCase() === email.toLowerCase());

  if (!user) {
    // Automatically register Google user
    const userId = `user-google-${Date.now()}`;
    user = {
      id: userId,
      name: name || email.split('@')[0],
      email: email.toLowerCase(),
      password: `google-auth-${Math.random().toString(36).substr(2, 8)}`,
      avatar: avatar || `https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=50&q=80`
    };
    db.users.push(user);

    // Create a default board for this user
    const defaultBoardId = `board-${Date.now()}`;
    const defaultBoard = {
      id: defaultBoardId,
      userId: userId,
      name: 'My Cozy Board 🌸',
      desc: 'Your first gravity-free board! Double click to add notes or drag local images to begin.',
      theme: '#FFB0B5',
      liked: false,
      likesCount: 0
    };
    db.boards.push(defaultBoard);
    writeDB(db);
  }

  // Get user's boards
  const userBoards = db.boards.filter(b => b.userId === user.id);

  res.json({
    success: true,
    user: { id: user.id, name: user.name, email: user.email, avatar: user.avatar },
    boards: userBoards
  });
});

// ==========================================
// DATA ROUTERS (BOARDS & CARDS)
// ==========================================

// Get boards of user
app.get('/api/boards', (req, res) => {
  const userId = req.headers['x-user-id'];
  if (!userId) return res.status(401).json({ error: 'Unauthorized.' });

  const db = readDB();
  const userBoards = db.boards.filter(b => b.userId === userId);
  res.json(userBoards);
});

// Create board
app.post('/api/boards', (req, res) => {
  const userId = req.headers['x-user-id'];
  if (!userId) return res.status(401).json({ error: 'Unauthorized.' });

  const { name, desc, theme } = req.body;
  if (!name) return res.status(400).json({ error: 'Board name required.' });

  const db = readDB();
  const newBoard = {
    id: `board-${Date.now()}`,
    userId: userId,
    name: name,
    desc: desc || '',
    theme: theme || '#FFB0B5',
    liked: false,
    likesCount: 0
  };
  db.boards.push(newBoard);
  writeDB(db);

  res.json(newBoard);
});

// Update board details
app.put('/api/boards/:id', (req, res) => {
  const userId = req.headers['x-user-id'];
  const boardId = req.params.id;
  if (!userId) return res.status(401).json({ error: 'Unauthorized.' });

  const { name, desc, theme } = req.body;

  const db = readDB();
  const boardIndex = db.boards.findIndex(b => b.id === boardId && b.userId === userId);
  if (boardIndex === -1) return res.status(404).json({ error: 'Board not found.' });

  db.boards[boardIndex].name = name || db.boards[boardIndex].name;
  db.boards[boardIndex].desc = desc !== undefined ? desc : db.boards[boardIndex].desc;
  db.boards[boardIndex].theme = theme || db.boards[boardIndex].theme;

  writeDB(db);
  res.json(db.boards[boardIndex]);
});

// Get cards of user
app.get('/api/cards', (req, res) => {
  const userId = req.headers['x-user-id'];
  if (!userId) return res.status(401).json({ error: 'Unauthorized.' });

  const db = readDB();
  const userCards = db.cards.filter(c => c.userId === userId);
  res.json(userCards);
});

// Create or Update card
app.post('/api/cards', (req, res) => {
  const userId = req.headers['x-user-id'];
  if (!userId) return res.status(401).json({ error: 'Unauthorized.' });

  const cardData = req.body;
  const db = readDB();

  const newCard = Object.assign({}, cardData, {
    userId: userId,
    id: cardData.id || `card-${Date.now()}`
  });

  const existingIndex = db.cards.findIndex(c => c.id === newCard.id && c.userId === userId);
  if (existingIndex > -1) {
    db.cards[existingIndex] = newCard;
  } else {
    db.cards.push(newCard);
  }

  writeDB(db);
  res.json(newCard);
});

// Delete card
app.delete('/api/cards/:id', (req, res) => {
  const userId = req.headers['x-user-id'];
  const cardId = req.params.id;
  if (!userId) return res.status(401).json({ error: 'Unauthorized.' });

  const db = readDB();
  const initialCount = db.cards.length;
  db.cards = db.cards.filter(c => !(c.id === cardId && c.userId === userId));

  if (db.cards.length === initialCount) {
    return res.status(404).json({ error: 'Card not found.' });
  }

  writeDB(db);
  res.json({ success: true });
});

// Get mood tracker logs
app.get('/api/moods', (req, res) => {
  const userId = req.headers['x-user-id'];
  if (!userId) return res.status(401).json({ error: 'Unauthorized.' });

  const db = readDB();
  const userMoods = db.moods.filter(m => m.userId === userId);
  res.json(userMoods);
});

// Log mood for the day
app.post('/api/moods', (req, res) => {
  const userId = req.headers['x-user-id'];
  if (!userId) return res.status(401).json({ error: 'Unauthorized.' });

  const { date, mood, color, tag, note } = req.body;
  if (!date || !mood) return res.status(400).json({ error: 'Missing date or mood.' });

  const db = readDB();
  const moodIndex = db.moods.findIndex(m => m.userId === userId && m.date === date);

  const moodEntry = { userId, date, mood, color, tag, note };

  if (moodIndex > -1) {
    db.moods[moodIndex] = moodEntry;
  } else {
    db.moods.push(moodEntry);
  }

  writeDB(db);
  res.json(moodEntry);
});

// GET all community published boards
app.get('/api/community', (req, res) => {
  const db = readDB();
  if (!db.community) {
    db.community = [];
  }
  res.json(db.community);
});

// Publish a board to the community
app.post('/api/community/publish', (req, res) => {
  const userId = req.headers['x-user-id'];
  if (!userId) return res.status(401).json({ error: 'Unauthorized.' });

  const { boardId } = req.body;
  if (!boardId) return res.status(400).json({ error: 'Missing boardId.' });

  const db = readDB();
  if (!db.community) {
    db.community = [];
  }

  // Find the user's board
  const board = db.boards.find(b => b.id === boardId && b.userId === userId);
  if (!board) {
    return res.status(404).json({ error: 'Board not found.' });
  }

  // Find all cards on this board
  const boardCards = db.cards.filter(c => c.boardId === boardId);

  // Get user details
  const user = db.users.find(u => u.id === userId);
  const authorName = user ? user.name : 'Cozy Creator';
  const authorAvatar = user ? user.avatar : 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=50&q=80';

  const commId = `community-${boardId}`;
  const communityEntry = {
    id: commId,
    boardId: boardId,
    name: board.name,
    desc: board.desc,
    theme: board.theme,
    author: authorName,
    authorAvatar: authorAvatar,
    likes: board.likesCount || 0,
    views: Math.floor(100 + Math.random() * 500),
    cards: boardCards
  };

  const existingIndex = db.community.findIndex(c => c.boardId === boardId);
  if (existingIndex > -1) {
    db.community[existingIndex] = communityEntry;
  } else {
    db.community.push(communityEntry);
  }

  writeDB(db);
  res.json({ success: true, communityBoard: communityEntry });
});

// Update user profile details
app.put('/api/users/profile', (req, res) => {
  const userId = req.headers['x-user-id'];
  if (!userId) return res.status(401).json({ error: 'Unauthorized.' });

  const { name, avatar, role } = req.body;
  const db = readDB();
  const userIndex = db.users.findIndex(u => u.id === userId);
  if (userIndex === -1) {
    return res.status(404).json({ error: 'User not found.' });
  }

  const updatedUser = Object.assign({}, db.users[userIndex], {
    name: name || db.users[userIndex].name,
    avatar: avatar || db.users[userIndex].avatar,
    role: role || db.users[userIndex].role
  });

  db.users[userIndex] = updatedUser;
  writeDB(db);

  res.json({ success: true, user: updatedUser });
});

// ==========================================
// EXTERNAL APIS & PROXIES
// ==========================================

// Pinterest Scraper API
app.get('/api/scrape-pinterest', async (req, res) => {
  const pinUrl = req.query.url;
  if (!pinUrl) {
    return res.status(400).json({ error: 'Missing Pinterest URL query parameter.' });
  }

  try {
    const response = await axios.get(pinUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5'
      }
    });

    const $ = cheerio.load(response.data);

    let ogImage = $('meta[property="og:image"]').attr('content') || 
                   $('meta[name="og:image"]').attr('content');
    
    let ogTitle = $('meta[property="og:title"]').attr('content') || 
                  $('meta[name="og:title"]').attr('content') ||
                  $('title').text();

    let ogDesc = $('meta[property="og:description"]').attr('content') ||
                 $('meta[name="og:description"]').attr('content') ||
                 $('meta[name="description"]').attr('content') ||
                 '';

    if (ogTitle) {
      ogTitle = ogTitle.split(' | ')[0].trim();
    }

    if (!ogImage) {
      const match = response.data.match(/"https:\/\/i\.pinimg\.com\/originals\/[a-zA-Z0-9_\-\/.]+\.jpg"/);
      if (match) {
        ogImage = match[0].replace(/"/g, '');
      } else {
        const match736 = response.data.match(/"https:\/\/i\.pinimg\.com\/736x\/[a-zA-Z0-9_\-\/.]+\.jpg"/);
        if (match736) {
          ogImage = match736[0].replace(/"/g, '');
        }
      }
    }

    if (!ogImage) {
      return res.status(404).json({ error: 'Could not extract image from Pin URL. Make sure it is a public Pin.' });
    }

    res.json({
      title: ogTitle || 'Pinterest Aesthetic Swatch',
      description: ogDesc || 'Fetched from Pinterest Pin',
      image: ogImage
    });

  } catch (error) {
    console.error('Pinterest scraping failed:', error.message);
    res.status(500).json({ error: 'Failed to retrieve Pin details. Check URL structure.' });
  }
});

// Image CORS Proxy API
app.get('/api/proxy-image', async (req, res) => {
  const imageUrl = req.query.url;
  if (!imageUrl) {
    return res.status(400).send('Missing url parameter');
  }

  try {
    const response = await axios({
      method: 'get',
      url: imageUrl,
      responseType: 'stream',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    res.setHeader('Content-Type', response.headers['content-type'] || 'image/jpeg');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    response.data.pipe(res);
  } catch (error) {
    console.error('Image proxy failed:', error.message);
    res.status(500).send('Failed to proxy image');
  }
});

// Collage file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'collage-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }
});

app.post('/api/upload-collage', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded.' });
  }
  const fileUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
  res.json({ success: true, link: fileUrl });
});

// Fallback serve html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Pastelly server successfully running at http://localhost:${PORT}`);
});
