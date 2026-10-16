import {z} from 'zod'

export const addToWatchlistSchema = z.object({
    movieId: z.string().uuid({version:"v4"}),
    status:z.enum(["PANNED", "WATCHING", "COMPLETED", "DROPPED"],{
        error:()=>({
            message:"status must be one of: PANNED, WATCHING, COMPLETED, DROPPED "
        })
    }),
    rating:z.coerce.number().int("Rating must be an integer").min(1, "Rating must bbetween 1 and 10").max(10, "Rating must be    between 1 and 10").optional(),

})