const express = require('express');
const app = express();
const PORT = 5000;

app.get('/', (req, res) => {
    res.send('Server is running smoothly!');
});

app.listen(PORT, () => {
    console.log(`Server is alive on http://localhost:${PORT}`);
});