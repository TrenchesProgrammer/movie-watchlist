import rateLimit from "express-rate-limit"
import express from 'express'

const app = express()

export const limiter = rateLimit({
    max:2,
    windowMs: 60*60*1000,
    message:"We have received too many requests from this IP please try again later"
})