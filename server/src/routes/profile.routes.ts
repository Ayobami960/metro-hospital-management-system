import { Router } from "express";
import { authenticate } from "../middleware/authenticate.js";
import {
  deleteMeOtherSessions,
  deleteMeSession,
  getHospital,
  getMePreferences,
  getMeProfile,
  getMeSessions,
  patchHospital,
  patchMePreferences,
  patchMeProfile,
} from "../controllers/profile.controller.js";

export const profileRouter = Router();

profileRouter.get("/me/profile", authenticate, getMeProfile);
profileRouter.patch("/me/profile", authenticate, patchMeProfile);
profileRouter.get("/me/preferences", authenticate, getMePreferences);
profileRouter.patch("/me/preferences", authenticate, patchMePreferences);
profileRouter.get("/me/sessions", authenticate, getMeSessions);
profileRouter.delete("/me/sessions/:id", authenticate, deleteMeSession);
profileRouter.delete("/me/sessions", authenticate, deleteMeOtherSessions);

profileRouter.get("/settings/hospital", authenticate, getHospital);
profileRouter.patch("/settings/hospital", authenticate, patchHospital);
