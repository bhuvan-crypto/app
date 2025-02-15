const express = require("express");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const { Server } = require("socket.io");
const http = require("http");
const ffmpeg = require("fluent-ffmpeg");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(cors());
app.use(express.json());
app.use(express.static("uploads"));
app.use(express.static("frames")); // Serve extracted frames

// Ensure 'frames/' directory exists
if (!fs.existsSync("frames")) fs.mkdirSync("frames");
// Multer configuration for video uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, "uploads/"),
    filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});``
const upload = multer({ storage });

app.post("/upload", upload.single("video"), (req, res) => {
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });
    res.json({ message: "Video uploaded successfully", filename: req.file.filename });
});

app.get("/videos", (req, res) => {
    fs.readdir("uploads/", (err, files) => {
        if (err) return res.status(500).json({ error: "Failed to read files" });
        res.json(files);
    });
});

// Function to extract frames
const extractFrames = (videoPath, framePath, callback) => {
    ffmpeg(videoPath)
        .on("end", callback)
        .on("error", (err) => console.error("FFmpeg Error:", err))
        .screenshots({
            timestamps: ["3"], // Extract frame at 3 seconds
            filename: framePath,
            folder: "frames/",
            size: "320x240" // Adjust frame size
        });
};

// Emit frames every 3 seconds
setInterval(() => {
//     const videos = fs.readdirSync("uploads/").slice(0, 4); // Pick 4 random videos

//     videos.forEach((video, index) => {
//         const frameFilename = `frame_${index}.jpg`;
//         const framePath = path.join("frames", frameFilename);

//         extractFrames(path.join("uploads", video), frameFilename, () => {
//             io.emit("frame", { index, frame: `http://localhost:5000/frames/${frameFilename}` });
//         });
//     });
}, 3000);

server.listen(5000, () => console.log("Server running on port 5000"));
