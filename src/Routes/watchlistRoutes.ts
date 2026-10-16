import express from 'express'
import { addToWatchlist, removeFromWatchlist, updateWatchlist } from '../controllers/watchlistController'
import { authMiddleware } from '../Middleware/authMiddleware'
import { limiter } from '../Middleware/rateLimit'
import { validateRequest } from '../Middleware/validateRequest'
import {addToWatchlistSchema} from "../validators/watchlistValidators"
const router = express.Router()
router.use(authMiddleware)
router.use(limiter)
router.post("/add", validateRequest(addToWatchlistSchema), addToWatchlist)
router.put("/update/:id", validateRequest(addToWatchlistSchema), updateWatchlist)
router.delete("/:id", removeFromWatchlist)

export default router;