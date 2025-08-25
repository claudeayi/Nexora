const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
require("dotenv").config();

const app = express();
app.use(cors({ origin: process.env.CORS_ORIGIN || "*" }));
app.use(express.json());
app.use(helmet());
app.use(morgan("dev"));

// routes
app.use("/auth", require("./routes/auth"));
app.use("/leads", require("./routes/leads"));
app.use("/links", require("./routes/links"));
app.use("/events", require("./routes/events"));
app.use("/experiments", require("./routes/experiments"));
app.use("/billing", require("./routes/billing"));
app.use("/", require("./routes/meta"));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`✅ Nexora API running on port ${PORT}`));
