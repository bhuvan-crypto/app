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
app.use("/frames", express.static(path.join(__dirname, "frames"))); // Serve frames

// Ensure 'frames/' directory exists
if (!fs.existsSync("frames")) fs.mkdirSync("frames");

// Multer storage for video uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, "uploads/"),
    filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

// Upload API
app.post("/upload", upload.single("video"), (req, res) => {
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });
    res.json({ message: "Video uploaded successfully", filename: req.file.filename });
});

// Fetch list of stored videos
app.get("/videos", (req, res) => {
    fs.readdir("uploads/", (err, files) => {
        if (err) return res.status(500).json({ error: "Failed to read files" });
        res.json(files);
    });
});

// Function to extract frames every 3 seconds
const extractFrames = (videoPath, outputPrefix, callback) => {
    ffmpeg(videoPath)
        .on("error", (err) => console.error("FFmpeg Error:", err))
        .on("end", () => callback(outputPrefix)) // Call callback after processing
        .screenshots({
            count: 10, // Extract 10 frames (optional)
            timemarks: ["3", "6", "9", "12", "15"], // Extract every 3 seconds
            filename: `${outputPrefix}-%03d.jpg`, // Save as frame_001.jpg, frame_002.jpg...
            folder: "frames/",
            size: "320x240"
        });
};

setInterval(() => {
    const videos = fs.readdirSync("uploads/");

    if (videos.length < 4) {
        console.log("Not enough videos available");
        return;
    }

    // Pick 4 random videos
    const selectedVideos = videos.sort(() => Math.random() - 0.5).slice(0, 4);

    selectedVideos.forEach((video, index) => {
        const outputPrefix = `frame_${index}`;

        // Pick a random timestamp between 1s and 10s for frame extraction
        const randomTime = Math.floor(Math.random() * 10) + 1;

        ffmpeg(path.join("uploads", video))
            .on("error", (err) => console.error("FFmpeg Error:", err))
            .on("end", () => {
                const frameFiles = fs.readdirSync("frames/").filter(file => file.startsWith(outputPrefix));
                if (frameFiles.length > 0) {
                    const randomFrame = frameFiles[Math.floor(Math.random() * frameFiles.length)];
                    console.log(`Sending frame: ${randomFrame}`);
                    io.emit("frame", { index, frame: `http://localhost:5000/frames/${randomFrame}` });
                }
            })
            .screenshots({
                timestamps: [`${randomTime}`], // Random time for frame extraction
                filename: `${outputPrefix}-%03d.jpg`,
                folder: "frames/",
                size: "320x240"
            });
    });
}, 3000);


server.listen(5000, () => console.log("Server running on port 5000"));
