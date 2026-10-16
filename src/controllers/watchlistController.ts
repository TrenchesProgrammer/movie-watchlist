import { Request, Response, RequestHandler } from "express";
import { prisma } from "../config/db";

export const addToWatchlist = async (req: Request, res: Response) => {
  const { movieId, status, rating, notes } = req.body;
  const userId = (req as Request & { user: { id: string } }).user.id;

  const movie = await prisma.movie.findUnique({
    where: { id: movieId },
  });

  if (!movie) {
    return res.status(400).json({
      error: "Could not find movie",
    });
  }

  const existsInWatchlist = await prisma.watchlist.findFirst({
    where: {
      userId,
      movieId,
    },
  });
  if(existsInWatchlist){
    return res.status(200).json({ error:"Movie already exists in watchlist" });
  }

  const watchlistItem = await prisma.watchlist.create({
    data:{
        userId,
        movieId,
        status: status || "PLANNED",
        rating,
        notes

    }

  })

  res.status(200).json({status:"success",
    data:{
        watchlistItem 
    }
  })
};


// Define a strict type for your authenticated request
interface AuthenticatedRequest extends Request {
  params: {
    id: string;
  };
  user: {
    id: string;
  };
}

export const removeFromWatchlist = async (req: Request, res: Response) => {

  const { id } = req.params;

if (typeof id !== "string") {
  return res.status(400).json({ error: "Invalid watchlist id" });
}

const watchlistId = id;
  // 1. Make sure the request is authenticated
  if (!req.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { id: userId } = req.user;

  // 2. Delete only if the item exists AND belongs to this user.
  //    One query prevents IDOR and avoids a race between find and delete.
  const result = await prisma.watchlist.deleteMany({
    where: { id: watchlistId, userId },
  });

  // 3. count is 0 when the item doesn't exist or belongs to someone else
  if (result.count === 0) {
    return res.status(404).json({
      error: "Could not find watchlist item or unauthorized",
    });
  }

  return res.status(200).json({
    status: "success",
    message: "Watchlist item deleted successfully",
  });
};

export const updateWatchlist = async (req:Request, res:Response) =>{

 interface updateTypes {

 }

  const rawId = req.params.id
  const id = Array.isArray(rawId) ? rawId[0] : rawId
  if (typeof id !== "string") {
    return res.status(400).json({ error: "Invalid watchlist id" })
  }
  const {notes, status, rating} = req.body
  
  const watchlistItem = await prisma.watchlist.findUnique({
    where:{id:id}
  })

  if(!watchlistItem){
    return res.status(404).json({
      error:"Watchlist item does not exist"
    })
  }

  if(!req.user || watchlistItem.userId !== req.user.id){
    return res.status(403).json({
      error:"You are not authorized to edit this item"
    })
  }

  const updateData: { status?: typeof watchlistItem.status; rating?: number } = {};
  if (status !== undefined) updateData.status = status.toUpperCase() as typeof watchlistItem.status;
  if (rating !== undefined) updateData.rating = rating;

  const updatedItem = await prisma.watchlist.update({
    where:{id: id},
    data: updateData
  })
  res.status(200).json({
    status:"success",
    data:{
      updatedItem
    }
  })
}