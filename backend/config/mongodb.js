// Connection string comes from the environment; never hard-code credentials.
require('dotenv').config();
module.exports = process.env.MONGODB_URI;
