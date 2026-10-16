import { Request, Response } from "express";
import { prisma } from "../config/db";
import bcrypt from "bcrypt";
import { generateToken } from "../utils/generateToken";
export const register = async (req: Request, res: Response) => {
  const body = req.body;
  const { name, email, password } = req.body;

  const userExists = await prisma.user.findUnique({
    where: { email: email },
  });

  if (userExists) {
    return res.status(400).json({
      error: "Email already exists",
    });
  }

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  const user = await prisma.user.create({
    data: {
      name,
      email,
      password: hashedPassword,
      provider: "local",
    },
  });
  const token = generateToken(user.id, res)
  return res.status(201).json({
    status: "success",
    data: {
      user: {
        id: user.id,
        name: name,
        email: email,
      },
      token
    },
  });
};
export const login = async (req: Request, res: Response) => {
  const { email, password } = req.body;
  const user = await prisma.user.findUnique({
    where: { email: email },
  });
  if(!user){
    return res.status(401).json({
        error:"Invalid email or password "
    })
  }

  if (!user.password) {
    return res.status(400).json({
      error: `This account was registered using ${user.provider || "social"} login. Please sign in using your ${user.provider || "social"} account.`,
    });
  }

  //Verify password

  const isPasswordValid = await bcrypt.compare(password, user.password)
  if(!isPasswordValid){
    return res.status(400).json({
        error:"invalid email or password"
    })
  }
  const token = generateToken(user.id, res)
  res.status(200).json({
    status:"success",
    data:{
        user:{
            id: user.id,
            email:email
        },
        token
    }
  })
};
export const logout = async(req:Request, res:Response) =>{
    res.cookie("jwt", "",{
        httpOnly:true,
        expires:new Date(0)
    })

    res.status(200).json({
        status:"success",
        message:"Logged out successfully"
    })
}