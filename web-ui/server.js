const express = require('express');
const path = require('path');
const { bqGenerate } = require('./query.js');

const app = express();
const PORT = 3000;

app.use(express.static(path.join(__dirname, 'src')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'src', 'index.html'));
});



app.get('/generate', async (req, res) => {
    const topic = req.query.topic;

    if (!topic) {
        res.status(400).send('Missing topic');
        return;
    }

    const suggestions = await bqGenerate(
        'workflows-demo-369108',
        'startup_ideas_generator',
        topic,
    );

    res.json(suggestions);
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

