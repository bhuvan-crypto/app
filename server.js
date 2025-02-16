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
app.use("/frames", express.static(path.join(__dirname, "frames"))); // Serve extracted frames

// Ensure 'frames/' directory exists
if (!fs.existsSync("frames")) fs.mkdirSync("frames");

// Multer storage for video uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, "uploads/"),
    filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

// Function to extract frames on upload
const extractFrames = (videoPath, videoName) => {
    return new Promise((resolve) => {
        ffmpeg(videoPath)
            .on("error", (err) => console.error("FFmpeg Error:", err))
            .on("end", () => {
                console.log(`Frames extracted for ${videoName}`);
                resolve();
            })
            .screenshots({
                count: 5, // Extract 5 frames (adjust if needed)
                timemarks: ["1", "3", "6", "9", "12"], // Extract frames at random timestamps
                filename: `${videoName.split(".")[0]}_%03d.jpg`, // Unique frame names
                folder: "frames/",
                size: "320x240"
            });
    });
};

// Upload API
app.post("/upload", upload.single("video"), async (req, res) => {
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });

    const videoPath = path.join("uploads", req.file.filename);
    const videoName = req.file.filename;

    // Extract frames immediately and store them in the frames folder
    await extractFrames(videoPath, videoName);

    res.json({ message: "Video uploaded and frames extracted", filename: videoName });
});

// Fetch list of stored videos
app.get("/videos", (req, res) => {
    fs.readdir("uploads/", (err, files) => {
        if (err) return res.status(500).json({ error: "Failed to read files" });
        res.json(files);
    });
});

// Function to fetch random frames from `frames/` folder
const getRandomFrames = () => {
    const frameFiles = fs.readdirSync("frames/").filter(file => file.endsWith(".jpg"));

    if (frameFiles.length < 4) {
        console.log("Not enough frames available.");
        return [];
    }

    // Pick 4 random frames
    return frameFiles
        .sort(() => Math.random() - 0.5) // Shuffle
        .slice(0, 4) // Select 4
        .map((frame, index) => ({
            index,
            frame: `http://localhost:5000/frames/${frame}`
        }));
};

// Send stored frames every 3 seconds
setInterval(() => {
    const framesToSend = getRandomFrames();
    if (framesToSend.length > 0) {
        // framesToSend.forEach(({ index, frame }) => {
        //     console.log(`Sending frame: ${frame}`);
        //     io.emit("frame", { index, frame });
        // });
      
        io.emit("frame", { frames:framesToSend });

    }
}, 3000);

server.listen(5000, () => console.log("Server running on port 5000"));
