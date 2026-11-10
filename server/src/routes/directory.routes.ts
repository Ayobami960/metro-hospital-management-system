import { Router } from "express";
import { authenticate } from "../middleware/authenticate.js";
import {
  getCptCodes,
  getDepartmentsLite,
  getInsurancePlans,
  getInsurers,
  getSpecialtiesLite,
  getUsers,
  patchUser,
  postUser,
} from "../controllers/directory.controller.js";

export const directoryRouter = Router();

directoryRouter.get("/users", authenticate, getUsers);
directoryRouter.post("/users", authenticate, postUser);
directoryRouter.patch("/users/:id", authenticate, patchUser);

directoryRouter.get("/reference/insurers", authenticate, getInsurers);
directoryRouter.get("/reference/insurance-plans", authenticate, getInsurancePlans);
directoryRouter.get("/reference/cpt", authenticate, getCptCodes);
directoryRouter.get("/reference/departments", authenticate, getDepartmentsLite);
directoryRouter.get("/reference/specialties", authenticate, getSpecialtiesLite);
