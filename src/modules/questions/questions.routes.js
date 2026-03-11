import { Router } from "express"
import {
  getQuestions,
  createQuestion,
  updateQuestion,
  deleteQuestion
} from "./questions.controller.js"

import authMiddleware from "../../middlewares/auth.js"

const router = Router()

router.get("/", authMiddleware, getQuestions)

router.post("/", authMiddleware, createQuestion)

router.put("/:id", authMiddleware, updateQuestion)

router.delete("/:id", authMiddleware, deleteQuestion)

export default router