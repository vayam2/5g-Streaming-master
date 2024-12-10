const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const cors = require("cors");
const bodyParser = require("body-parser");
const mqtt = require("mqtt");
const { createCanvas } = require("canvas");
const jpeg = require("jpeg-js"); // Ensure you have this dependency installed

// Create an instance of Express
const app = express();
const server = http.createServer(app);

// CORS setup
const corsOptions = {
  origin: "https://droneyaan.com", // Replace with your front-end's URL
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true, // Allow cookies or authorization headers
};

app.use(cors(corsOptions));

// Middleware to ensure HTTPS redirection (if Express is behind a proxy like NGINX)
app.use((req, res, next) => {
  if (req.headers["x-forwarded-proto"] !== "https") {
    return res.redirect("https://" + req.headers.host + req.url);
  }
  next();
});

// Use body parser to handle JSON payloads
app.use(bodyParser.json());
app.use(express.static("public"));

let gpsData = { lat: 37.7749, lon: -122.4194, alt: 100 }; // Default to San Francisco
let weatherData = { description: "Clear Sky" }; // Default weather data

// Endpoint to get GPS data
app.get("/api/gps", (req, res) => {
  res.json(gpsData);
});

// Endpoint to get weather data
app.get("/api/weather", (req, res) => {
  const { lat, lon } = req.query;
  res.json(weatherData);
});

// Endpoint to update GPS data (for demonstration purposes)
app.post("/api/gps", (req, res) => {
  const { lat, lon, alt } = req.body;
  gpsData = { lat, lon, alt };
  res.json(gpsData);
});

// Endpoint to simulate starting/stopping recording (for demonstration purposes)
app.post("/api/record", (req, res) => {
  res.send("Recording action simulated");
});

// Endpoint for login
app.post("/api/login", (req, res) => {
  const { droneName, droneId } = req.body;
  console.log(droneName, droneId);

  res.json({ message: "Login successful", droneName, droneId });
});

// Route to handle root requests
app.get("/", (req, res) => {
  res.send("Welcome to the Drone Backend API!");
});

// Initialize WebSocket server (Socket.IO)
const io = socketIo(server, {
  cors: {
    origin: "https://droneyaan.com", // Frontend URL
    methods: ["GET", "POST"],
  },
});

io.on("connection", (socket) => {
  console.log("A client connected");

  // Start video stream
  socket.on("start-stream", () => {
    console.log("Starting video stream");
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected");
  });
});

// MQTT setup to subscribe and stream live images
const MQTT_BROKER_URL = "mqtt://65.0.71.42:1883"; // Replace with your MQTT broker URL
const TOPIC_GPS = "drone/gps";
const TOPIC_WEATHER = "drone/weather";
const TOPIC_IMAGE = "test"; // Topic for live image data

const mqttClient = mqtt.connect(MQTT_BROKER_URL);

mqttClient.on("connect", () => {
  console.log("Connected to MQTT broker");

  // Subscribe to topics
  mqttClient.subscribe(TOPIC_GPS);
  mqttClient.subscribe(TOPIC_WEATHER);
  mqttClient.subscribe(TOPIC_IMAGE);
});

mqttClient.on("message", (topic, message) => {
  console.log(`Received topic: ${topic}`);
  console.log("Message payload:", message);

  if (topic === TOPIC_GPS) {
    const data = JSON.parse(message.toString());
    gpsData = data;
    io.emit("gps-data", gpsData);
  } else if (topic === TOPIC_WEATHER) {
    const data = JSON.parse(message.toString());
    weatherData = data;
    io.emit("weather-data", weatherData);
  } else if (topic === TOPIC_IMAGE) {
    try {
      // Attempt to decode the image
      const rawImage = jpeg.decode(message); // Decode the JPEG image
      console.log("Decoded image:", rawImage);

      if (rawImage) {
        // Use canvas to display the image
        const canvas = createCanvas(rawImage.width, rawImage.height);
        const ctx = canvas.getContext("2d");
        const imgData = ctx.createImageData(rawImage.width, rawImage.height);
        imgData.data.set(rawImage.data);
        ctx.putImageData(imgData, 0, 0);

        // Convert canvas to image data URL
        const dataURL = canvas.toDataURL("image/jpeg");

        // Broadcast the image data to all connected clients via Socket.IO
        io.emit("live-image", { image: dataURL });
      } else {
        console.error("Failed to decode the image.");
      }
    } catch (err) {
      console.error("Error decoding image:", err);
    }
  }
});

// Start the server on a specific port
const port = 5000;
server.listen(port, "0.0.0.0", () => {
  console.log(`Server running on https://13.127.226.95:${port}`);
});
