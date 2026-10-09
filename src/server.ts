import express from 'express'
import movieRoute from "./Routes/movieRoutes"
import {config} from "dotenv"
import { connectDB, disconnectDB } from './config/db';

config();
connectDB();

const app = express()

app.use("/movies", movieRoute)

const PORT = 4000


const server = app.listen(PORT, ()=>{
    console.log("Server runnig on port: ", PORT)
})

process.on("unhandledRejection", (err)=>{
    console.error("Unhandled Rejection:", err)
    server.close(async () =>{
        await disconnectDB();
        process.exit(1);
    })
})

process.on("UncaughtException", (err)=>{
    console.error("Uncaught Exception:", err)
    server.close(async () =>{
        await disconnectDB();
        process.exit(1);
    })
})

process.on("SIGTERM", (err)=>{
    console.error("SIGTERM received, shutting down gracefully ")
    server.close(async () =>{
        await disconnectDB();
        process.exit(0);
    })
})


