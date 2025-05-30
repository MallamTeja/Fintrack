const app = require('./server');

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Frontend server is running on http://localhost:${PORT}`);
});
